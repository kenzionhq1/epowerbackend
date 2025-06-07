const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Raw body parser for webhook
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-paystack-signature"];

  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== signature) return res.status(401).send("Unauthorized");

  const event = JSON.parse(req.body);

  if (event.event === "charge.success" && event.data.status === "success") {
    const { email, amount, reference } = event.data;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).send("User not found");

      user.balance += amount / 100;
      await user.save();

      await Transaction.create({
        userId: user._id,
        amount: amount / 100,
        type: "topup",
        reference,
      });

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook handling failed:", err.message);
      return res.status(500).send("Server error");
    }
  }

  res.sendStatus(200);
});

module.exports = router;
