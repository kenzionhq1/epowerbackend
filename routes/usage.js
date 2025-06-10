const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'month'; // Support for time period filtering
    const now = new Date();

    // Get all transactions for the user
    const transactions = await Transaction.find({ userId }).sort({ timestamp: 1 });
    
    if (transactions.length === 0) {
      return res.json({
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        monthlyUsage: [0, 0, 0, 0, 0, 0],
        week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        dailySpend: [0, 0, 0, 0, 0, 0, 0],
        hourlyLabels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
        hourlyUsage: [0, 0, 0, 0, 0, 0, 0, 0],
        summary: {
          avgDailyUsage: 0,
          avgDailyCost: 0,
          peakUsageTime: '6pm-9pm',
          usageTrend: 0,
          costTrend: 0
        }
      });
    }

    // Calculate the average kWh per Naira based on typical electricity rates
    // This simulates converting payment amounts to electricity units
    const kwhPerNaira = 0.25; // Assume 4 Naira per kWh (adjust based on actual rates)
    
    // Generate more realistic monthly usage data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = now.getMonth();
    
    // Get last 6 months (or fewer if not enough history)
    const months = [];
    const monthlyUsage = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      months.unshift(monthNames[monthIndex]);
      monthlyUsage.unshift(0);
    }
    
    // Calculate monthly usage based on transactions
    // This simulates electricity consumption from payment patterns
    transactions.forEach(t => {
      const transactionDate = new Date(t.timestamp);
      const monthDiff = (now.getMonth() - transactionDate.getMonth() + 12) % 12;
      
      if (monthDiff < 6) {
        const monthIndex = 5 - monthDiff;
        // Convert payment amount to kWh
        const kwhEquivalent = t.amount * kwhPerNaira;
        monthlyUsage[monthIndex] += kwhEquivalent;
      }
    });
    
    // Apply seasonal variations to make data more realistic
    for (let i = 0; i < monthlyUsage.length; i++) {
      const actualMonthIndex = (currentMonth - 5 + i + 12) % 12;
      
      // Summer months use more electricity (AC), winter months also higher (heating)
      const seasonalFactor = [1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 1.0, 1.1][actualMonthIndex];
      monthlyUsage[i] = Math.round(monthlyUsage[i] * seasonalFactor);
    }

    // Daily spend data - create realistic pattern based on day of week
    // People typically use more electricity on weekends
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailySpend = Array(7).fill(0);
    
    // Calculate average daily spend from transactions
    const totalSpend = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgDailySpend = totalSpend / (transactions.length || 1);
    
    // Create realistic daily pattern
    dailySpend[0] = avgDailySpend * 1.2; // Sunday
    dailySpend[1] = avgDailySpend * 0.9; // Monday
    dailySpend[2] = avgDailySpend * 0.85; // Tuesday
    dailySpend[3] = avgDailySpend * 0.9; // Wednesday
    dailySpend[4] = avgDailySpend * 0.95; // Thursday
    dailySpend[5] = avgDailySpend * 1.1; // Friday
    dailySpend[6] = avgDailySpend * 1.3; // Saturday
    
    // Adjust based on actual transaction patterns
    transactions.forEach(t => {
      const diffDays = Math.floor((now - new Date(t.timestamp)) / (1000 * 60 * 60 * 24));
      if (diffDays < 14) { // Use last 2 weeks of data to influence pattern
        const day = new Date(t.timestamp).getDay(); // 0 = Sunday
        dailySpend[day] = (dailySpend[day] * 2 + t.amount) / 3; // Blend with actual data
      }
    });
    
    // Round to whole numbers
    for (let i = 0; i < dailySpend.length; i++) {
      dailySpend[i] = Math.round(dailySpend[i]);
    }

    // Hourly usage - create realistic daily consumption pattern
    const hourlyLabels = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
    
    // Typical household electricity usage pattern (in watts)
    // Low overnight, peak in morning, dip during day, highest in evening
    const typicalPattern = [400, 300, 600, 800, 700, 900, 1200, 900];
    
    // Scale the pattern based on user's average consumption
    const avgMonthlyUsage = monthlyUsage.reduce((sum, val) => sum + val, 0) / monthlyUsage.length;
    const scaleFactor = avgMonthlyUsage / 300; // Adjust based on expected average
    
    const hourlyUsage = typicalPattern.map(val => Math.round(val * scaleFactor));
    
    // Calculate summary statistics
    const avgDailyUsage = (avgMonthlyUsage / 30).toFixed(1);
    const avgDailyCost = Math.round(avgDailySpend);
    
    // Find peak usage time
    let maxUsage = 0;
    let peakIndex = 0;
    hourlyUsage.forEach((usage, index) => {
      if (usage > maxUsage) {
        maxUsage = usage;
        peakIndex = index;
      }
    });
    const peakUsageTime = hourlyLabels[peakIndex];
    
    // Calculate trends (comparing to "previous period")
    // Simulate slight variations for realistic trends
    const usageTrend = Math.round((Math.random() * 20) - 10); // -10% to +10%
    const costTrend = Math.round((Math.random() * 20) - 10); // -10% to +10%

    res.json({
      months,
      monthlyUsage,
      week: weekdays,
      dailySpend,
      hourlyLabels,
      hourlyUsage,
      summary: {
        avgDailyUsage,
        avgDailyCost,
        peakUsageTime,
        usageTrend,
        costTrend
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load usage data", error: err.message });
  }
});

module.exports = router;