const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ Gmail SMTP Error:", err.message);
  } else {
    console.log("✅ Gmail SMTP is ready to send emails");
  }
});

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // Ensure it's a string
}

// =================== Signup ===================
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const existing = await User.findOne({ email });

    if (existing && existing.verified)
      return res.status(400).json({ message: "Email already in use and verified" });

    const code = generateCode();
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.findOneAndUpdate(
      { email },
      {
        username,
        password: hashed,
        verificationCode: code,
        verificationCodeExpires: Date.now() + 5 * 60 * 1000,
        verified: false
      },
      { upsert: true, new: true }
    );

    await transporter.sendMail({
      from: `"e-Power" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Verify Your e-Power Account",
      html: `
        <div style="font-family:sans-serif;padding:20px">
          <h2 style="color:#2563eb;">Welcome, ${username}!</h2>
          <p>Your verification code is:</p>
          <h1 style="color:#2563eb;">${code}</h1>
          <p>Expires in 5 minutes.</p>
        </div>
      `
    });

    console.log(`📤 Verification email sent to: ${email}`);
    res.status(201).json({ message: "Verification code sent to your email" });
  } catch (err) {
    res.status(500).json({ message: "Signup failed" });
  }
});

// =================== Verify Code ===================
router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: "Email and code are required" });

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.verified) return res.status(200).json({ message: "Already verified" });

    if (
      user.verificationCode != code || // loose check for string/number
      Date.now() > user.verificationCodeExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: "✅ Account verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

// =================== Resend Code ===================
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
      subject: "🔁 Your New e-Power Verification Code",
      html: `
        <div style="font-family:sans-serif;padding:20px">
          <h2 style="color:#2563eb;">New Verification Code</h2>
          <p>Code:</p>
          <h1 style="color:#2563eb;">${code}</h1>
          <p>Valid for 5 minutes.</p>
        </div>
      `
    });

    res.json({ message: "New code sent to your email." });
  } catch (err) {
    res.status(500).json({ message: "Resend failed" });
  }
});

// =================== Signin ===================
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.verified) return res.status(403).json({ message: "Please verify your email" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

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
    res.status(500).json({ message: "Signin failed" });
  }
});

// =================== Request Password Reset ===================
router.post("/request-reset", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.verified) return res.status(403).json({ message: "Email not verified yet" });

    const code = generateCode();
    user.resetCode = code;
    user.resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save();

    await transporter.sendMail({
      from: `"e-Power Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Reset Your Password",
      html: `
        <div style="font-family:sans-serif;padding:20px">
          <h2 style="color:#2563eb;">Reset Password</h2>
          <p>Use this code to reset your password:</p>
          <h1 style="color:#2563eb;">${code}</h1>
          <p>Expires in 10 minutes.</p>
        </div>
      `
    });

    res.json({ message: "Reset code sent" });
  } catch (err) {
    res.status(500).json({ message: "Could not send reset code" });
  }
});

// =================== Verify Reset Code ===================
router.post("/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: "Email and code are required" });

  try {
    const user = await User.findOne({ email });

    console.log("Stored:", user.resetCode, "Incoming:", code);

    if (
      !user ||
      user.resetCode != code || // loose comparison
      Date.now() > user.resetCodeExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    res.json({ message: "Reset code valid" });
  } catch (err) {
    res.status(500).json({ message: "Code verification failed" });
  }
});

// =================== Reset Password ===================
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const user = await User.findOne({ email });

    if (
      !user ||
      user.resetCode != code || // loose comparison
      Date.now() > user.resetCodeExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();

    res.json({ message: "✅ Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Password reset failed" });
  }
});

module.exports = router;
