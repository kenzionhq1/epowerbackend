const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  balance: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
verificationToken: { type: String }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
