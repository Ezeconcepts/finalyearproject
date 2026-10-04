const { isEmail } = require("validator");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "please enter a name"],
    },

    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      validate: [isEmail, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "password is required"],
      minlength: [6, "password should be at least 6 characters"],
      select: false,
    },

    // --- Hybrid cryptography key material (ECC secp256k1) ---
    // Public key is stored in the clear; the private key is stored encrypted
    // at rest ("iv:tag:ciphertext") with the server MASTER_KEY.
    eccPublicKey: {
      type: String,
      select: false,
    },
    eccPrivateKeyEnc: {
      type: String,
      select: false,
    },

    uploads: [],
    encrypted: [],
  },
  { timestamps: true }
);

// Hash the password with bcrypt before saving (only when it changed).
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare a candidate password against the stored bcrypt hash.
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", UserSchema);
