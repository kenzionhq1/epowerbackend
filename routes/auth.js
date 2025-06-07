// routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Generate 4-digit code
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ SMTP Transporter (Brevo)
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ✅ Signup: Create unverified user & send code
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const existing = await User.findOne({ email });
    if (existing && existing.verified)
      return res.status(400).json({ message: "Email already verified and in use" });

    const code = generateCode();
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.findOneAndUpdate(
      { email },
      {
        username,
        password: hashed,
        verificationCode: code,
        verificationCodeExpires: Date.now() + 5 * 60 * 1000, // 5 minutes
        verified: false
      },
      { upsert: true, new: true }
    );

    await transporter.sendMail({
      from: `"e-Power" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your e-Power account",
      html: `
        <h3>Hi ${username},</h3>
        <p>Your verification code is:</p>
        <h2 style="color:#2563eb;">${code}</h2>
        <p>This code expires in 5 minutes.</p>
      `
    });

    res.status(201).json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ✅ Verify Code
router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: "Email and code are required" });

  try {
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.verified)
      return res.status(200).json({ message: "User already verified" });

    if (
      user.verificationCode !== code ||
      Date.now() > user.verificationCodeExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ✅ Resend Code
router.post("/resend-code", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.verified)
      return res.status(400).json({ message: "User not found or already verified" });

    const code = generateCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: `"e-Power" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "New Verification Code",
      html: `
        <h3>Hi ${user.username},</h3>
        <p>Your new verification code is:</p>
        <h2 style="color:#2563eb;">${code}</h2>
        <p>This code expires in 5 minutes.</p>
      `
    });

    res.status(200).json({ message: "New code sent to your email." });
  } catch (err) {
    console.error("Resend code error:", err.message);
    res.status(500).json({ message: "Could not resend code" });
  }
});

// ✅ Signin
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.verified)
      return res.status(401).json({ message: "Please verify your email first" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      }
    });
  } catch (err) {
    console.error("Signin error:", err.message);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

module.exports = router;
