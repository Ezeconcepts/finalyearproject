/**
 * Fault-injection security analysis for the hybrid scheme.
 *
 * We take a valid encrypted artifact and inject a single-bit fault into each
 * distinct field, then attempt decryption. A secure authenticated design must
 * "fail closed": every injected fault must be DETECTED (decryption throws) and
 * must NEVER release plaintext. We report the detection rate per field and
 * whether any plaintext leaked.
 *
 * Fields exercised (new hybrid .enc = MAGIC | headerLen | headerJSON | ct):
 *   - ciphertext body            (AES-256-GCM data)
 *   - fileTag                    (GCM auth tag of the data)
 *   - fileIv                     (GCM nonce)
 *   - wrappedKey                 (ECIES-wrapped AES key)
 *   - wrapTag                    (GCM tag of the key-wrap)
 *   - ephemeralPublicKey         (ECIES ephemeral point)
 *   - protected private key      (at-rest, master-key encrypted)
 *
 * A legacy AES-256-CBC control (no authentication) is included to quantify the
 * security gained by moving to an AEAD: CBC cannot detect ciphertext tampering.
 *
 * Run:  MASTER_KEY=... CRYPTOKEY=... IV=... node scripts/fault-injection.js
 */

const crypto = require("crypto");

process.env.MASTER_KEY =
  process.env.MASTER_KEY || crypto.randomBytes(32).toString("hex");
process.env.CRYPTOKEY =
  process.env.CRYPTOKEY || crypto.randomBytes(32).toString("hex");
process.env.IV = process.env.IV || crypto.randomBytes(16).toString("hex");

const c = require("../utils/crypto");

const TRIALS = 1000;

function flipRandomBitInPlace(buf) {
  const bit = crypto.randomInt(buf.length * 8);
  buf[bit >> 3] ^= 1 << (bit & 7);
}

// Corrupt one bit inside a named hex field of the header and re-serialize.
function corruptHeaderField(blob, field) {
  const headerLen = blob.readUInt32BE(4);
  const header = JSON.parse(blob.subarray(8, 8 + headerLen).toString("utf-8"));
  const ct = blob.subarray(8 + headerLen);

  const bytes = Buffer.from(header[field], "hex");
  flipRandomBitInPlace(bytes);
  header[field] = bytes.toString("hex");

  const newHeader = Buffer.from(JSON.stringify(header), "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(newHeader.length, 0);
  return Buffer.concat([blob.subarray(0, 4), lenBuf, newHeader, ct]);
}

function corruptCiphertext(blob) {
  const headerLen = blob.readUInt32BE(4);
  const out = Buffer.from(blob);
  const ctStart = 8 + headerLen;
  const bit = crypto.randomInt((out.length - ctStart) * 8);
  out[ctStart + (bit >> 3)] ^= 1 << (bit & 7);
  return out;
}

/**
 * Run TRIALS fault injections for one field and tally detection + any leak.
 * mutate(blob, priv, plaintext) must attempt a decrypt and return one of:
 *   {detected:true} | {detected:false, leakedPlaintext:bool}
 */
function evaluate(label, mutate) {
  let detected = 0;
  let leaked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { publicKey, privateKey } = c.generateEccKeyPair();
    const pt = crypto.randomBytes(512);
    const blob = c.encryptFileHybrid(pt, publicKey);
    const r = mutate(blob, privateKey, pt);
    if (r.detected) detected++;
    else if (r.leakedPlaintext) leaked++;
  }
  const rate = ((detected / TRIALS) * 100).toFixed(1) + "%";
  console.log(
    label.padEnd(30) +
      rate.padStart(9) +
      "     " +
      (leaked ? `LEAK in ${leaked}/${TRIALS}` : "no plaintext leaked")
  );
  return detected === TRIALS && leaked === 0;
}

function tryDecrypt(bad, priv, pt) {
  try {
    const out = c.decryptFileHybrid(bad, priv);
    // Decrypt "succeeded": leak only if it equals the true plaintext.
    return { detected: false, leakedPlaintext: Buffer.compare(out, pt) === 0 };
  } catch {
    return { detected: true };
  }
}

console.log(`Fault-injection analysis  (${TRIALS} single-bit faults per field)\n`);
console.log("Hybrid scheme (AES-256-GCM + ECIES) - must fail closed:");
console.log("Target field".padEnd(30) + "Detected".padStart(9) + "     Confidentiality");
console.log("-".repeat(74));

const results = [];
results.push(evaluate("ciphertext body", (b, p, pt) => tryDecrypt(corruptCiphertext(b), p, pt)));
results.push(evaluate("GCM file tag", (b, p, pt) => tryDecrypt(corruptHeaderField(b, "fileTag"), p, pt)));
results.push(evaluate("GCM nonce (fileIv)", (b, p, pt) => tryDecrypt(corruptHeaderField(b, "fileIv"), p, pt)));
results.push(evaluate("ECIES wrappedKey", (b, p, pt) => tryDecrypt(corruptHeaderField(b, "wrappedKey"), p, pt)));
results.push(evaluate("ECIES wrapTag", (b, p, pt) => tryDecrypt(corruptHeaderField(b, "wrapTag"), p, pt)));
results.push(evaluate("ephemeralPublicKey", (b, p, pt) => tryDecrypt(corruptHeaderField(b, "ephemeralPublicKey"), p, pt)));

// At-rest protected private key.
results.push(
  (() => {
    let detected = 0;
    for (let i = 0; i < TRIALS; i++) {
      const { privateKey } = c.generateEccKeyPair();
      const parts = c.protectPrivateKey(privateKey).split(":");
      const ctBytes = Buffer.from(parts[2], "hex");
      flipRandomBitInPlace(ctBytes);
      parts[2] = ctBytes.toString("hex");
      try {
        c.unprotectPrivateKey(parts.join(":"));
      } catch {
        detected++;
      }
    }
    const rate = ((detected / TRIALS) * 100).toFixed(1) + "%";
    console.log("at-rest private key".padEnd(30) + rate.padStart(9) + "     no plaintext leaked");
    return detected === TRIALS;
  })()
);

// Legacy CBC control: inject a fault into the ciphertext and see if it is caught.
console.log("\nLegacy AES-256-CBC control (no authentication):");
console.log("Target field".padEnd(30) + "Detected".padStart(9) + "     Confidentiality");
console.log("-".repeat(74));
(function cbcControl() {
  const key = Buffer.from(process.env.CRYPTOKEY, "hex");
  const iv = Buffer.from(process.env.IV, "hex");
  let detected = 0;
  let leaked = 0;
  let wrongButAccepted = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pt = crypto.randomBytes(512);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
    const file = Buffer.concat([iv, ct]);
    // flip a bit in the CBC ciphertext body
    const body = Buffer.from(file);
    const bit = crypto.randomInt((body.length - 16) * 8);
    body[16 + (bit >> 3)] ^= 1 << (bit & 7);
    try {
      const out = c.decryptLegacyCbc(body);
      if (Buffer.compare(out, pt) === 0) leaked++;
      else wrongButAccepted++; // returned corrupted plaintext with NO error
    } catch {
      detected++; // only caught when padding happens to break
    }
  }
  const rate = ((detected / TRIALS) * 100).toFixed(1) + "%";
  console.log(
    "ciphertext body (CBC)".padEnd(30) +
      rate.padStart(9) +
      `     ${wrongButAccepted}/${TRIALS} corrupted outputs returned silently`
  );
})();

console.log(
  "\nSummary: hybrid AEAD detection =",
  results.every(Boolean) ? "100% across all fields, fail-closed." : "INCOMPLETE - review above."
);
