/**
 * Benchmark for the hybrid scheme (AES-256-GCM + ECIES/secp256k1).
 *
 * Encrypts and decrypts random files of 500 KB, 3 MB, 5 MB and 10 MB and
 * reports the wall-clock time for each, regenerating the numbers used in
 * Chapter 4 (Tables 4.1 / 4.2). Averages over several iterations.
 *
 * Run:  MASTER_KEY=$(openssl rand -hex 32) node scripts/benchmark.js
 *   or: node -r dotenv/config scripts/benchmark.js dotenv_config_path=./config/.env
 */

const {
  generateEccKeyPair,
  encryptFileHybrid,
  decryptFileHybrid,
} = require("../utils/crypto");

if (!process.env.MASTER_KEY) {
  // The benchmark itself doesn't touch private-key-at-rest storage, but keep
  // a value present so the module's helpers never complain.
  process.env.MASTER_KEY = require("crypto").randomBytes(32).toString("hex");
}

const SIZES = [
  { label: "500 KB", bytes: 500 * 1024 },
  { label: "3 MB", bytes: 3 * 1024 * 1024 },
  { label: "5 MB", bytes: 5 * 1024 * 1024 },
  { label: "10 MB", bytes: 10 * 1024 * 1024 },
];
const ITERATIONS = 5;

function timeMs(fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  const t1 = process.hrtime.bigint();
  return { ms: Number(t1 - t0) / 1e6, out };
}

function main() {
  const { publicKey, privateKey } = generateEccKeyPair();

  console.log("Hybrid crypto benchmark  (AES-256-GCM + ECIES secp256k1)");
  console.log(`Node ${process.version} | ${ITERATIONS} iterations averaged\n`);
  console.log(
    "Size".padEnd(10) + "Encrypt (avg)".padEnd(16) + "Decrypt (avg)"
  );
  console.log("-".repeat(42));

  for (const { label, bytes } of SIZES) {
    const data = require("crypto").randomBytes(bytes);
    let encSum = 0;
    let decSum = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const enc = timeMs(() => encryptFileHybrid(data, publicKey));
      encSum += enc.ms;
      const dec = timeMs(() => decryptFileHybrid(enc.out, privateKey));
      decSum += dec.ms;
      if (!dec.out.equals(data)) throw new Error(`round-trip mismatch @ ${label}`);
    }

    const enc = (encSum / ITERATIONS / 1000).toFixed(3) + "s";
    const dec = (decSum / ITERATIONS / 1000).toFixed(3) + "s";
    console.log(label.padEnd(10) + enc.padEnd(16) + dec);
  }
  console.log("\nAll round-trips verified byte-identical.");
}

main();
