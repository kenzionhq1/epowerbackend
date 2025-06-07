const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL; // e.g. https://yourdomain.com

const Brevo = require('@getbrevo/brevo');
const defaultClient = Brevo.ApiClient.instance;

const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY; // from .env

const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit

const sendBrevoVerification = async (email, username, code) => {
  const apiInstance = new Brevo.TransactionalEmailsApi();
  const sendSmtpEmail = {
    to: [{ email }],
    sender: { name: "e-Power", email: process.env.EMAIL_USER },
    subject: "Verify your e-Power account",
    htmlContent: `
      <h3>Hello ${username},</h3>
      <p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p>
    `
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: "All fields are required" });

  const existingUser = await User.findOne({ email });

  if (existingUser && existingUser.verified) {
    return res.status(400).json({ message: "Email already verified and in use" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const code = generateCode();

  if (existingUser && !existingUser.verified) {
    // Update unverified user
    existingUser.username = username;
    existingUser.password = hashed;
    existingUser.verificationCode = code;
    existingUser.codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await existingUser.save();
    await sendBrevoVerification(email, username, code);
    return res.status(200).json({ message: "Verification code resent. Please check your email." });
  }

  // New user
  const user = new User({
    username,
    email,
    password: hashed,
    verified: false,
    verificationCode: code,
    codeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  await user.save();
  await sendBrevoVerification(email, username, code);

  res.status(201).json({ message: "Signup successful. Please check your email for the verification code." });
});

router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.verified) return res.status(200).json({ message: "Already verified" });

  if (user.verificationCode !== code) {
    return res.status(400).json({ message: "Invalid verification code" });
  }

  if (user.codeExpiresAt < new Date()) {
    return res.status(400).json({ message: "Code has expired" });
  }

  user.verified = true;
  user.verificationCode = undefined;
  user.codeExpiresAt = undefined;
  await user.save();

  res.status(200).json({ message: "Email verified successfully" });
});




router.post("/resend-code", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user || user.verified) return res.status(400).json({ message: "User not found or already verified" });

  const code = generateCode();
  user.verificationCode = code;
  user.codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  await sendBrevoVerification(email, user.username, code);
  res.status(200).json({ message: "Verification code resent" });
});



// Signin
// Sign In
router.post("/signin", async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(403).json({ message: "Please verify your email to continue" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
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