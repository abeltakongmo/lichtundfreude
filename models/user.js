const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      unique: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    sessionTokenHash: {
      type: String,
      select: false,
    },
    sessionExpiresAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);
