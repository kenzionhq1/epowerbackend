const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // Get all transactions for the user
    const transactions = await Transaction.find({ userId });

    // Monthly Usage (Real)
    const monthlyUsage = Array(6).fill(0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    transactions.forEach(t => {
      const m = new Date(t.timestamp).getMonth();
      if (m >= 0 && m < 6) {
        monthlyUsage[m] += t.amount;
      }
    });

    // Daily Spend: Last 7 days
    const week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailySpend = Array(7).fill(0);

    transactions.forEach(t => {
      const diffDays = Math.floor((now - new Date(t.timestamp)) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        const day = new Date(t.timestamp).getDay(); // 0 = Sunday
        dailySpend[day] += t.amount;
      }
    });

    // Hourly Usage (Simulated Buckets)
    const hourlyBuckets = [0, 0, 0, 0, 0, 0, 0, 0];
    const hourLabels = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];

    transactions.forEach(t => {
      const h = new Date(t.timestamp).getHours();
      const bucket = Math.floor(h / 3); // 0-7
      if (bucket < 8) {
        hourlyBuckets[bucket] += t.amount;
      }
    });

    res.json({
      months,
      monthlyUsage,
      week,
      dailySpend,
      hourlyLabels: hourLabels,
      hourlyUsage: hourlyBuckets
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load usage data", error: err.message });
  }
});

module.exports = router;
