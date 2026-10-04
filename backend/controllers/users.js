const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { ensureUserKeys } = require("../utils/userKeys");
const {
  generateEccKeyPair,
  protectPrivateKey,
} = require("../utils/crypto");

// Basic password requirement (kept lenient so existing users are unaffected).
const MIN_PASSWORD_LEN = 6;

// Ensure a user has an ECC key pair; create and persist one if missing.
// Non-fatal: if key material can't be provisioned (e.g. MASTER_KEY not set),
// we log and continue so that logging in / signing up never breaks.

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Password + ECC fields are `select:false`, so request them explicitly.
    const user = await User.findOne({ email }).select(
      "+password +eccPublicKey +eccPrivateKeyEnc"
    );

    if (!user) {
      return res.json({
        error: true,
        messages: "please check your login details and try again",
      });
    }

    // Verify the password. New accounts are bcrypt-hashed; older accounts may
    // still hold a plaintext password from before hashing was introduced.
    let ok = false;
    try {
      ok = await user.comparePassword(password);
    } catch {
      ok = false;
    }

    // Legacy fallback: plaintext match -> accept and transparently upgrade
    // the stored password to a bcrypt hash so it's secure going forward.
    if (!ok && typeof user.password === "string" && user.password === password) {
      ok = true;
      try {
        const hash = await bcrypt.hash(password, await bcrypt.genSalt(12));
        await User.updateOne({ _id: user._id }, { $set: { password: hash } });
      } catch (e) {
        console.warn("password upgrade skipped:", e.message);
      }
    }

    if (!ok) {
      return res.json({
        error: true,
        messages: "please check your login details and try again",
      });
    }

    try {
      await ensureUserKeys(user); // back-fill ECC keys for legacy accounts
    } catch (err) {
      console.warn("ECC key provisioning skipped:", err.message);
    }

    res.json({ userId: user._id, username: user.fullName });
  } catch (error) {
    console.log(error);
    res.json({
      error: true,
      messages: "please check your login details and try again",
    });
  }
};

exports.register = async (req, res, next) => {
  const { email, password, fullName } = req.body;
  try {
    if (!password || password.length < MIN_PASSWORD_LEN) {
      return res.json({
        error: true,
        messages: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      });
    }

    // Provision the user's ECC key pair (non-fatal if MASTER_KEY is missing).
    let keyFields = {};
    try {
      const { publicKey, privateKey } = generateEccKeyPair();
      keyFields = {
        eccPublicKey: publicKey,
        eccPrivateKeyEnc: protectPrivateKey(privateKey),
      };
    } catch (e) {
      console.warn("ECC key provisioning skipped at register:", e.message);
    }

    const user = await User.create({
      email,
      password, // hashed by the model's pre-save hook
      fullName,
      ...keyFields,
    });

    res.json({ userId: user._id, username: user.fullName });
  } catch (error) {
    const messages = [];
    if (error.code === 11000) {
      messages.push(Object.values(error.keyValue) + " already exists");
    } else if (error.name === "ValidationError") {
      messages.push(
        Object.values(error.errors).map((err) => err.message).join(", ")
      );
    } else {
      messages.push("Could not create account. Please try again.");
    }
    res.json({ error: true, messages });
  }
};
