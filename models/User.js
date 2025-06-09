const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  verified: {
    type: Boolean,
    default: false
  },

  verificationCode: {
    type: String // 4-digit code sent to email for verification
  },

  verificationCodeExpires: {
    type: Date
  },

  resetCode: {
    type: String // for password reset
  },

  resetCodeExpires: {
    type: Date
  },

  balance: {
    type: Number,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);
