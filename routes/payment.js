const express = require("express");
const router = express.Router();
const axios = require("axios");
const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const VTPASS_USERNAME = process.env.VTPASS_USERNAME;
const VTPASS_PASSWORD = process.env.VTPASS_PASSWORD;
const VTPASS_BASE = "https://api-service.vtpass.com/api";

const headers = {
  "api-key": VTPASS_USERNAME,
  "secret-key": VTPASS_PASSWORD,
  "Content-Type": "application/json"
};

// Verify meter
router.post("/verify", auth, async (req, res) => {
  const { disco, meter } = req.body;
  try {
    const response = await axios.post(`${VTPASS_BASE}/merchant-verify`, {
      serviceID: disco,
      billersCode: meter,
      type: "prepaid"
    }, { headers });

    const data = response.data;
    if (data.code === "000") {
      res.json({
        customer_name: data.content.Customer_Name,
        meter_type: data.content.MeterType,
        debt: data.content.amount
      });
    } else {
      res.status(400).json({ message: data.response_description });
    }
  } catch (err) {
    res.status(500).json({ message: "Verification error", error: err.message });
  }
});

// Make payment
router.post("/", auth, async (req, res) => {
  const { disco, meter, amount } = req.body;
  const userId = req.user.id;
  const reference = `epwr_${Date.now()}`;

  try {
    const user = await User.findById(userId);
    if (!user || user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const payRes = await axios.post(`${VTPASS_BASE}/pay`, {
      request_id: reference,
      serviceID: disco,
      billersCode: meter,
      variation_code: "",
      amount,
      phone: user.email // optional phone
    }, { headers });

    const result = payRes.data;

    // Save transaction
    const transaction = new Transaction({
      user: userId,
      type: "payment",
      amount,
      meter,
      disco,
      reference,
      status: result.code === "000" ? "success" : "failed",
      token: result?.content?.token || null,
      rawResponse: result
    });

    await transaction.save();

    if (result.code === "000") {
      // Deduct balance
      user.balance -= amount;
      await user.save();
      res.json({ message: "Payment successful", response: result });
    } else {
      res.status(400).json({ message: result.response_description });
    }
  } catch (err) {
    res.status(500).json({ message: "Payment error", error: err.message });
  }
});

module.exports = router;
