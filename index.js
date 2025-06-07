const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config({ path: "./config/.env" });
const BASE_URL = process.env.BASE_URL;    
const app = express();

// CORS FIX

app.options("*", cors());
const allowedOrigins = [
  "https://e-power-beryl.vercel.app",
  "http://localhost:5000" ,
  "https://e-power-beryl.vercel.app/signup.html",
  // Add other allowed origins here
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// Middleware

app.use(cors());
app.use(express.json());
// Routes
const authRoutes = require("./routes/auth");
const usageRoutes = require("./routes/usage");
const paymentRoutes = require("./routes/payment");
const userRoutes = require("./routes/user");
const webhookRoutes = require("./routes/webhook");
const topupRoutes = require("./routes/topup");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/topup", topupRoutes); // ✅ only once

// Default route
app.get("/", (req, res) => {
  res.send("⚡ Electricity Payment API is live");
});

// DB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ Mongo Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
