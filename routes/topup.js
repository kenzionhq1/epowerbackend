const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const axios = require("axios");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// @route   POST /api/topup/initiate
// @desc    Initiate top-up using Paystack
// @access  Private
router.post("/initiate", auth, async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 100) {
    return res.status(400).json({ message: "Minimum top-up is ₦100" });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const reference = `epay_${Date.now()}`;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: amount * 100, // Convert to Kobo
        reference,
        callback_url: "https://e-power-beryl.vercel.app/dashboard.html" // Optional callback
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      authorization_url: paystackRes.data.data.authorization_url,
      reference
    });

  } catch (err) {
    console.error("Top-up initiate error:", err.response?.data || err.message);
    res.status(500).json({ message: "Top-up initiation failed" });
  }
});

module.exports = router;
