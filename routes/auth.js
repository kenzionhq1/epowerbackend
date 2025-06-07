const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Brevo config
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// Generate 4-digit code
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ Sign up with email verification code
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.verified) {
      return res.status(400).json({ message: "Email already registered" });
    } else {
      // Allow re-registering unverified users by deleting stale records
      await User.deleteOne({ email });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const code = generateCode();
  const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now

  const user = new User({
    username,
    email,
    password: hashedPassword,
    verified: false,
    verificationCode: code,
    codeExpires: expiry
  });

  await user.save();

  // Send code via Brevo
  try {
    await emailApi.sendTransacEmail({
      sender: { name: "e-Power", email: process.env.SENDER_EMAIL },
      to: [{ email }],
      subject: "e-Power Verification Code",
      htmlContent: `
        <h3>Hello ${username},</h3>
        <p>Your verification code is:</p>
        <h2>${code}</h2>
        <p>This code will expire in 5 minutes.</p>
      `
    });

    res.status(201).json({ message: "Signup successful. Check your email for the verification code." });
  } catch (err) {
    console.error("Email send error:", err.message);
    res.status(500).json({ message: "Signup failed. Could not send verification email." });
  }
});

// ✅ Verify email using 4-digit code
router.post("/verify", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: "Email and code required" });

  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.verified) return res.status(400).json({ message: "Already verified" });

  if (user.verificationCode !== code)
    return res.status(400).json({ message: "Invalid verification code" });

  if (Date.now() > user.codeExpires)
    return res.status(400).json({ message: "Verification code expired" });

  user.verified = true;
  user.verificationCode = undefined;
  user.codeExpires = undefined;
  await user.save();

  res.status(200).json({ message: "✅ Email verified successfully!" });
});

module.exports = router;
