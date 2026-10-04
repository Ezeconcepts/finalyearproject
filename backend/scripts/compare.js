/**
 * Comparative benchmark  ─  regenerates Chapter 4 Tables 4.1 & 4.2.
 *
 * Measures encryption + decryption time for the proposed hybrid scheme
 * against two established hybrid baselines, on identical random inputs of
 * 500 KB, 3 MB, 5 MB and 10 MB (averaged over several iterations):
 *
 *   • AES-256-GCM + ECC (secp256k1)   -- the proposed scheme
 *   • 3DES-CBC       + RSA-2048       -- native (Node crypto)
 *   • Blowfish-CBC   + RSA-2048       -- pure-JS (optional dep)
 *
 * Each baseline follows the same hybrid pattern: a random symmetric key
 * encrypts the data, and that key is wrapped with a 2048-bit RSA public key.
 *
 * Run:  MASTER_KEY=$(openssl rand -hex 32) node scripts/compare.js
 * Blowfish row requires:  npm i -D egoroof-blowfish
 */

const crypto = require("crypto");
const { generateEccKeyPair, encryptFileHybrid, decryptFileHybrid } = require("../utils/crypto");

if (!process.env.MASTER_KEY) {
  process.env.MASTER_KEY = crypto.randomBytes(32).toString("hex");
}

const SIZES = [
  { label: "500 KB", bytes: 500 * 1024 },
  { label: "3 MB", bytes: 3 * 1024 * 1024 },
  { label: "5 MB", bytes: 5 * 1024 * 1024 },
  { label: "10 MB", bytes: 10 * 1024 * 1024 },
];
const ITERATIONS = 5;

const ns = () => process.hrtime.bigint();
const secs = (sumNs) => (Number(sumNs) / 1e9 / ITERATIONS).toFixed(3) + "s";

/* ---- Proposed: AES-256-GCM + ECC (secp256k1) ------------------------- */
function makeProposed() {
  const { publicKey, privateKey } = generateEccKeyPair();
  return {
    name: "AES-256+ECC (proposed)",
    enc: (data) => encryptFileHybrid(data, publicKey),
    dec: (blob) => decryptFileHybrid(blob, privateKey),
  };
}

/* ---- Baseline factory: <symmetric>-CBC + RSA-2048 -------------------- */
function makeRsaBaseline(name, symEncrypt, symDecrypt) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    name,
    enc: (data) => {
      const { key, iv, ct } = symEncrypt(data);
      const wrappedKey = crypto.publicEncrypt(publicKey, key);
      return { wrappedKey, iv, ct };
    },
    dec: ({ wrappedKey, iv, ct }) => {
      const key = crypto.privateDecrypt(privateKey, wrappedKey);
      return symDecrypt(key, iv, ct);
    },
  };
}

function tripleDes() {
  return makeRsaBaseline(
    "3DES+RSA",
    (data) => {
      const key = crypto.randomBytes(24);
      const iv = crypto.randomBytes(8);
      const c = crypto.createCipheriv("des-ede3-cbc", key, iv);
      return { key, iv, ct: Buffer.concat([c.update(data), c.final()]) };
    },
    (key, iv, ct) => {
      const d = crypto.createDecipheriv("des-ede3-cbc", key, iv);
      return Buffer.concat([d.update(ct), d.final()]);
    }
  );
}

// Blowfish is optional: OpenSSL 3 dropped it, so we use a pure-JS package.
function blowfish() {
  let Blowfish;
  try {
    ({ Blowfish } = require("egoroof-blowfish"));
  } catch {
    return null; // dependency not installed -> row skipped
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    name: "Blowfish+RSA",
    enc: (data) => {
      const key = crypto.randomBytes(16);
      const bf = new Blowfish(key, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
      const ct = Buffer.from(bf.encode(data));
      const wrappedKey = crypto.publicEncrypt(publicKey, key);
      return { wrappedKey, ct };
    },
    dec: ({ wrappedKey, ct }) => {
      const key = crypto.privateDecrypt(privateKey, wrappedKey);
      const bf = new Blowfish(key, Blowfish.MODE.ECB, Blowfish.PADDING.PKCS5);
      return Buffer.from(bf.decode(new Uint8Array(ct), Blowfish.TYPE.UINT8_ARRAY));
    },
  };
}

function run() {
  const schemes = [makeProposed(), blowfish(), tripleDes()].filter(Boolean);

  console.log("Comparative hybrid-crypto benchmark");
  console.log(`Node ${process.version} | ${ITERATIONS} iterations averaged\n`);

  const encRows = {};
  const decRows = {};

  for (const s of schemes) {
    for (const { label, bytes } of SIZES) {
      const data = crypto.randomBytes(bytes);
      let encSum = 0n;
      let decSum = 0n;
      for (let i = 0; i < ITERATIONS; i++) {
        let t = ns();
        const blob = s.enc(data);
        encSum += ns() - t;
        t = ns();
        const out = s.dec(blob);
        decSum += ns() - t;
        if (!Buffer.from(out).equals(data)) {
          throw new Error(`${s.name} round-trip mismatch @ ${label}`);
        }
      }
      (encRows[label] ||= {})[s.name] = secs(encSum);
      (decRows[label] ||= {})[s.name] = secs(decSum);
    }
  }

  const names = schemes.map((s) => s.name);
  const printTable = (title, rows) => {
    console.log(title);
    console.log(["Size".padEnd(9), ...names.map((n) => n.padEnd(24))].join(""));
    for (const { label } of SIZES) {
      console.log(
        [label.padEnd(9), ...names.map((n) => (rows[label][n] || "-").padEnd(24))].join("")
      );
    }
    console.log("");
  };

  printTable("Table 4.1 — Encryption time", encRows);
  printTable("Table 4.2 — Decryption time", decRows);
  console.log("All round-trips verified byte-identical.");
}

run();
