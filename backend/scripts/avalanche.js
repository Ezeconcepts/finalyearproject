/**
 * Avalanche / diffusion analysis for the hybrid scheme's symmetric core
 * (AES-256-GCM, which is AES-256 in counter mode + GHASH authentication).
 *
 * The avalanche effect / Strict Avalanche Criterion (SAC) says that flipping
 * a single input bit should flip ~50% of the output bits. We measure it on:
 *
 *   1. KEY avalanche      - flip 1 bit of the AES-256 key  -> keystream change
 *   2. NONCE avalanche    - flip 1 bit of the 96-bit nonce -> keystream change
 *   3. PLAINTEXT -> TAG   - flip 1 bit of plaintext        -> GCM tag change
 *   4. Single-block SAC   - per-bit map on one AES block (AES-256-ECB)
 *
 * Note (interpretation): AES-GCM encrypts as a STREAM (C = P XOR keystream),
 * so a 1-bit *plaintext* change flips only the 1 corresponding *ciphertext*
 * bit by design -- that is a property of counter mode, not a weakness. The
 * diffusion that matters lives in (a) the keystream when the key/nonce change
 * and (b) the authentication tag, both measured below.
 *
 * Run:  node scripts/avalanche.js
 */

const crypto = require("crypto");

const TRIALS = 2000;
const PT_BYTES = 1024; // plaintext block used for keystream/tag measurements

function hammingBits(a, b) {
  const n = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < n; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff;
}

function flipRandomBit(buf) {
  const out = Buffer.from(buf);
  const bit = crypto.randomInt(out.length * 8);
  out[bit >> 3] ^= 1 << (bit & 7);
  return out;
}

// AES-256-GCM keystream = ciphertext of a fixed plaintext under (key, nonce).
function gcmCiphertext(key, nonce, pt) {
  const c = crypto.createCipheriv("aes-256-gcm", key, nonce);
  return { ct: Buffer.concat([c.update(pt), c.final()]), tag: c.getAuthTag() };
}

function stats(samples) {
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return {
    mean,
    sd,
    min: Math.min(...samples),
    max: Math.max(...samples),
  };
}

function pct(x) {
  return (x * 100).toFixed(2) + "%";
}

function runKeyAvalanche() {
  const totalBits = PT_BYTES * 8;
  const pt = Buffer.alloc(PT_BYTES, 0); // fixed plaintext -> ct == keystream
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    const key = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const c1 = gcmCiphertext(key, nonce, pt).ct;
    const c2 = gcmCiphertext(flipRandomBit(key), nonce, pt).ct;
    samples.push(hammingBits(c1, c2) / totalBits);
  }
  return stats(samples);
}

function runNonceAvalanche() {
  const totalBits = PT_BYTES * 8;
  const pt = Buffer.alloc(PT_BYTES, 0);
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    const key = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const c1 = gcmCiphertext(key, nonce, pt).ct;
    const c2 = gcmCiphertext(key, flipRandomBit(nonce), pt).ct;
    samples.push(hammingBits(c1, c2) / totalBits);
  }
  return stats(samples);
}

function runPlaintextTagAvalanche() {
  const totalBits = 128; // GCM tag is 128 bits
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    const key = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const pt = crypto.randomBytes(PT_BYTES);
    const t1 = gcmCiphertext(key, nonce, pt).tag;
    const t2 = gcmCiphertext(key, nonce, flipRandomBit(pt)).tag;
    samples.push(hammingBits(t1, t2) / totalBits);
  }
  return stats(samples);
}

// Per-bit Strict Avalanche Criterion on a single AES-256 block (ECB, 1 block).
function runSingleBlockSAC() {
  const samples = [];
  for (let t = 0; t < TRIALS; t++) {
    const key = crypto.randomBytes(32);
    const block = crypto.randomBytes(16);
    const enc = (b) => {
      const c = crypto.createCipheriv("aes-256-ecb", key, null);
      c.setAutoPadding(false);
      return Buffer.concat([c.update(b), c.final()]);
    };
    const base = enc(block);
    const bit = crypto.randomInt(128);
    const flipped = Buffer.from(block);
    flipped[bit >> 3] ^= 1 << (bit & 7);
    samples.push(hammingBits(base, enc(flipped)) / 128);
  }
  return stats(samples);
}

function line(name, s) {
  console.log(
    name.padEnd(34) +
      pct(s.mean).padStart(8) +
      ("  sd " + pct(s.sd)).padEnd(14) +
      "min " + pct(s.min) + "  max " + pct(s.max)
  );
}

console.log(`Avalanche / diffusion analysis  (${TRIALS} trials each)\n`);
console.log("Test".padEnd(34) + "Mean".padStart(8) + "  (target 50%)");
console.log("-".repeat(74));
line("AES-256 key avalanche", runKeyAvalanche());
line("AES-256 nonce avalanche", runNonceAvalanche());
line("Plaintext -> GCM tag avalanche", runPlaintextTagAvalanche());
line("Single-block SAC (AES-256)", runSingleBlockSAC());
console.log("\nInterpretation: values clustering at ~50% indicate strong diffusion.");
