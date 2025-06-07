const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL; // e.g. https://yourdomain.com

// Setup Brevo Transport
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS
  }
});

// 📩 Signup Endpoint
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1d" });

    const user = new User({
      username,
      email,
      password: hashed,
      verified: false,
      verificationToken: token
    });

    await user.save();

    // 📧 Send verification email
    const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
    await transporter.sendMail({
      from: `"e-Power" <${process.env.BREVO_USER}>`,
      to: email,
      subject: "Please verify your e-Power account",
      html: `
        <h3>Hello ${username},</h3>
        <p>Thank you for registering on e-Power. Please click below to verify your email:</p>
        <p><a href="${verificationUrl}" style="padding:10px 15px; background:#2563eb; color:white; text-decoration:none;">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
      `
    });

    res.status(201).json({ message: "Signup successful. Check your email to verify your account." });

  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ✅ Verify Email Endpoint
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) return res.status(400).send("Verification token missing.");

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user) return res.status(404).send("User not found.");
    if (user.verified) return res.send("✅ Your email is already verified.");

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.send(`
      <h2>✅ Email Verified!</h2>
      <p>Your account has been verified. You can now <a href="/signin.html">sign in</a>.</p>
    `);
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(400).send("Invalid or expired verification link.");
  }
});






// Signin
// SIGN IN
router.post("/signin", async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Check if email is verified
    if (!user.verified) {
      return res.status(403).json({ message: "Please verify your email before signing in." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });
    res.status(200).json({
      token,
      user: {
        username: user.username,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (err) {
    console.error("Signin error:", err.message);
    res.status(500).json({ message: "Signin failed" });
  }
});


module.exports = router;