/**
 * Unit tests for the hybrid cryptography module (AES-256-GCM + ECC secp256k1).
 * Uses Node's built-in test runner:  node --test  (or  npm test).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// The module reads MASTER_KEY at call time; set one for the test process.
process.env.MASTER_KEY =
  process.env.MASTER_KEY || crypto.randomBytes(32).toString("hex");
// Values for the legacy AES-256-CBC fallback test.
process.env.CRYPTOKEY =
  process.env.CRYPTOKEY || crypto.randomBytes(32).toString("hex");
process.env.IV = process.env.IV || crypto.randomBytes(16).toString("hex");

const c = require("../utils/crypto");

test("ECC key pair is a valid secp256k1 uncompressed point", () => {
  const { publicKey, privateKey } = c.generateEccKeyPair();
  assert.equal(publicKey.slice(0, 2), "04"); // uncompressed prefix
  assert.equal(Buffer.from(publicKey, "hex").length, 65);
  assert.equal(Buffer.from(privateKey, "hex").length, 32);
});

test("private key protection round-trips and is not stored in the clear", () => {
  const { privateKey } = c.generateEccKeyPair();
  const stored = c.protectPrivateKey(privateKey);
  assert.ok(!stored.includes(privateKey));
  assert.equal(c.unprotectPrivateKey(stored), privateKey);
});

test("tampering with a protected private key is detected", () => {
  const { privateKey } = c.generateEccKeyPair();
  const parts = c.protectPrivateKey(privateKey).split(":");
  parts[2] = parts[2].slice(0, -2) + "00"; // corrupt ciphertext
  assert.throws(() => c.unprotectPrivateKey(parts.join(":")));
});

test("hybrid encryption round-trips binary data byte-for-byte", () => {
  const { publicKey, privateKey } = c.generateEccKeyPair();
  const data = Buffer.concat([
    Buffer.from([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]),
    crypto.randomBytes(8192),
  ]);
  const blob = c.encryptFileHybrid(data, publicKey);
  assert.ok(c.isHybridFormat(blob));
  assert.deepEqual(c.decryptFileHybrid(blob, privateKey), data);
});

test("each encryption produces distinct ciphertext (fresh key/IV per file)", () => {
  const { publicKey } = c.generateEccKeyPair();
  const data = crypto.randomBytes(1024);
  assert.ok(
    !c.encryptFileHybrid(data, publicKey).equals(c.encryptFileHybrid(data, publicKey))
  );
});

test("tampered ciphertext is rejected by GCM integrity check", () => {
  const { publicKey, privateKey } = c.generateEccKeyPair();
  const blob = c.encryptFileHybrid(crypto.randomBytes(2048), publicKey);
  blob[blob.length - 1] ^= 0x01;
  assert.throws(() => c.decryptFileHybrid(blob, privateKey));
});

test("wrong ECC private key cannot decrypt", () => {
  const a = c.generateEccKeyPair();
  const b = c.generateEccKeyPair();
  const blob = c.encryptFileHybrid(crypto.randomBytes(2048), a.publicKey);
  assert.throws(() => c.decryptFileHybrid(blob, b.privateKey));
});

test("legacy AES-256-CBC files still decrypt via fallback", () => {
  const key = Buffer.from(process.env.CRYPTOKEY, "hex");
  const iv = Buffer.from(process.env.IV, "hex");
  const plain = Buffer.from("legacy cbc payload");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const legacyFile = Buffer.concat([iv, ct]); // old layout: [16B IV][ciphertext]

  assert.ok(!c.isHybridFormat(legacyFile));
  assert.deepEqual(c.decryptLegacyCbc(legacyFile), plain);
});
