/**
 * Hybrid cryptography utility  ─  AES-256-GCM  +  ECC (secp256k1)
 * ---------------------------------------------------------------
 * This module implements the hybrid scheme described in the project
 * document (Chapter 3.3 / 4.2):
 *
 *   • Each file is encrypted with a fresh, random AES-256 key using
 *     AES-256-GCM (authenticated encryption -> confidentiality + integrity).
 *   • That per-file AES key is then wrapped (encrypted) with the user's
 *     ECC public key using ECIES over the secp256k1 curve:
 *         ephemeral ECDH  ->  HKDF-SHA256  ->  AES-256-GCM key-wrap.
 *   • The user's ECC private key is stored server-side, encrypted at rest
 *     with a server MASTER_KEY (AES-256-GCM) -- the "server-side KMS".
 *
 * Legacy files produced by the old AES-256-CBC code (format: [16-byte IV]
 * ++ [ciphertext]) are still decryptable via decryptLegacyCbc().
 *
 * Uses only Node's built-in `crypto` module (no external crypto deps).
 */

const crypto = require("crypto");

const CURVE = "secp256k1";
const FILE_MAGIC = Buffer.from("FF02", "ascii"); // version tag for the new hybrid format
const HKDF_INFO = Buffer.from("forteFile-ecies-v2");

/* ------------------------------------------------------------------ *
 *  ECC key-pair generation
 * ------------------------------------------------------------------ */

/**
 * Generate a fresh secp256k1 key pair.
 * @returns {{ publicKey: string, privateKey: string }} hex-encoded keys.
 *          publicKey is the uncompressed point (65 bytes, 0x04 prefix).
 */
function generateEccKeyPair() {
  const ecdh = crypto.createECDH(CURVE);
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey("hex", "uncompressed"),
    privateKey: ecdh.getPrivateKey("hex"),
  };
}

/* ------------------------------------------------------------------ *
 *  Server-side key management (encryption-at-rest of private keys)
 * ------------------------------------------------------------------ */

function getMasterKey() {
  const hex = process.env.MASTER_KEY;
  if (!hex) throw new Error("MASTER_KEY is not set in the environment");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("MASTER_KEY must be 32 bytes (64 hex chars)");
  return key;
}

/**
 * Encrypt a user's ECC private key for storage. Returns "iv:tag:ciphertext" (hex).
 */
function protectPrivateKey(privateKeyHex) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(privateKeyHex, "hex")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), ct.toString("hex")].join(":");
}

/**
 * Decrypt a stored ECC private key. Input is "iv:tag:ciphertext" (hex).
 * @returns {string} private key hex.
 */
function unprotectPrivateKey(stored) {
  const key = getMasterKey();
  const [ivHex, tagHex, ctHex] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return pt.toString("hex");
}

/* ------------------------------------------------------------------ *
 *  ECIES  ─  wrap / unwrap the per-file AES key with ECC keys
 * ------------------------------------------------------------------ */

/**
 * ECIES-encrypt (wrap) a symmetric key to a recipient's ECC public key.
 * @param {Buffer} plainKey      the 32-byte per-file AES key to protect
 * @param {string} recipientPub  recipient ECC public key (hex, uncompressed)
 * @returns {{ ephemeralPublicKey, wrapIv, wrapTag, wrappedKey }} hex fields
 */
function eciesWrap(plainKey, recipientPub) {
  const ephemeral = crypto.createECDH(CURVE);
  ephemeral.generateKeys();

  const shared = ephemeral.computeSecret(Buffer.from(recipientPub, "hex"));
  const ephemeralPublicKey = ephemeral.getPublicKey(null, "uncompressed");

  // Derive an AES key from the shared secret; bind it to the ephemeral pubkey.
  const derived = Buffer.from(
    crypto.hkdfSync("sha256", shared, ephemeralPublicKey, HKDF_INFO, 32)
  );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derived, iv);
  const wrapped = Buffer.concat([cipher.update(plainKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ephemeralPublicKey: ephemeralPublicKey.toString("hex"),
    wrapIv: iv.toString("hex"),
    wrapTag: tag.toString("hex"),
    wrappedKey: wrapped.toString("hex"),
  };
}

/**
 * ECIES-decrypt (unwrap) a symmetric key with the recipient's ECC private key.
 * @returns {Buffer} the recovered per-file AES key.
 */
function eciesUnwrap({ ephemeralPublicKey, wrapIv, wrapTag, wrappedKey }, recipientPrivHex) {
  const ecdh = crypto.createECDH(CURVE);
  ecdh.setPrivateKey(Buffer.from(recipientPrivHex, "hex"));

  const ephPub = Buffer.from(ephemeralPublicKey, "hex");
  const shared = ecdh.computeSecret(ephPub);
  const derived = Buffer.from(crypto.hkdfSync("sha256", shared, ephPub, HKDF_INFO, 32));

  const decipher = crypto.createDecipheriv("aes-256-gcm", derived, Buffer.from(wrapIv, "hex"));
  decipher.setAuthTag(Buffer.from(wrapTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(wrappedKey, "hex")),
    decipher.final(),
  ]);
}

/* ------------------------------------------------------------------ *
 *  File encryption / decryption (hybrid)
 * ------------------------------------------------------------------ */

/**
 * Encrypt file bytes under the hybrid scheme and return a self-contained
 * buffer that carries the wrapped key in its header, so it can round-trip
 * through Dropbox without any database dependency.
 *
 * Layout:  MAGIC(4) | headerLen(4, BE) | headerJSON | ciphertext
 *
 * @param {Buffer} data          plaintext file bytes (binary-safe)
 * @param {string} recipientPub  user's ECC public key (hex)
 * @returns {Buffer}
 */
function encryptFileHybrid(data, recipientPub) {
  const fileKey = crypto.randomBytes(32); // per-file AES-256 key
  const fileIv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", fileKey, fileIv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const fileTag = cipher.getAuthTag();

  const wrap = eciesWrap(fileKey, recipientPub);

  const header = Buffer.from(
    JSON.stringify({
      alg: "AES-256-GCM+ECIES-secp256k1",
      ...wrap,
      fileIv: fileIv.toString("hex"),
      fileTag: fileTag.toString("hex"),
    }),
    "utf-8"
  );

  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32BE(header.length, 0);

  return Buffer.concat([FILE_MAGIC, headerLen, header, ciphertext]);
}

/** True if a buffer is in the new hybrid (FF02) format. */
function isHybridFormat(buf) {
  return buf.length >= 4 && buf.subarray(0, 4).equals(FILE_MAGIC);
}

/**
 * Decrypt a hybrid-format buffer using the recipient's ECC private key.
 * @param {Buffer} buf           the .enc contents (MAGIC | len | header | ct)
 * @param {string} recipientPriv user's ECC private key (hex)
 * @returns {Buffer} plaintext
 */
function decryptFileHybrid(buf, recipientPriv) {
  if (!isHybridFormat(buf)) throw new Error("Not a hybrid-format file");

  const headerLen = buf.readUInt32BE(4);
  const header = JSON.parse(buf.subarray(8, 8 + headerLen).toString("utf-8"));
  const ciphertext = buf.subarray(8 + headerLen);

  const fileKey = eciesUnwrap(header, recipientPriv);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    fileKey,
    Buffer.from(header.fileIv, "hex")
  );
  decipher.setAuthTag(Buffer.from(header.fileTag, "hex"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Legacy fallback: decrypt files produced by the old AES-256-CBC code,
 * whose layout was [16-byte IV] ++ [ciphertext] and which used the static
 * CRYPTOKEY / IV from the environment.
 */
function decryptLegacyCbc(buf) {
  const key = Buffer.from(process.env.CRYPTOKEY, "hex");
  const iv = Buffer.from(process.env.IV, "hex");
  const cipherText = buf.subarray(16); // drop the prepended IV
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}

module.exports = {
  generateEccKeyPair,
  protectPrivateKey,
  unprotectPrivateKey,
  eciesWrap,
  eciesUnwrap,
  encryptFileHybrid,
  decryptFileHybrid,
  decryptLegacyCbc,
  isHybridFormat,
};
