const User = require("../models/User");
const { generateEccKeyPair, protectPrivateKey } = require("./crypto");

async function ensureUserKeys(user) {
  if (!user) throw new Error("File owner was not found.");
  if (user.eccPublicKey && user.eccPrivateKeyEnc) return user;
  // Never replace existing key material: older files may depend on it.
  if (user.eccPublicKey || user.eccPrivateKeyEnc) {
    throw new Error("Account encryption keys are incomplete. Restore the original keys before encrypting files.");
  }
  const { publicKey, privateKey } = generateEccKeyPair();
  const encryptedKey = protectPrivateKey(privateKey);
  // Concurrent requests must all use the same persisted key pair.
  const owner = await User.findOneAndUpdate(
    { _id: user._id, eccPublicKey: { $in: [null, ""] }, eccPrivateKeyEnc: { $in: [null, ""] } },
    { $set: { eccPublicKey: publicKey, eccPrivateKeyEnc: encryptedKey } },
    { new: true }
  ).select("+eccPublicKey +eccPrivateKeyEnc");
  if (owner) return owner;
  const current = await User.findById(user._id).select("+eccPublicKey +eccPrivateKeyEnc");
  if (!current?.eccPublicKey || !current?.eccPrivateKeyEnc) {
    throw new Error("Account encryption keys could not be provisioned.");
  }
  return current;
}

module.exports = { ensureUserKeys };
