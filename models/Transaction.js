const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["topup", "payment"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  meter: {
    type: String,
    default: null
  },
  disco: {
    type: String,
    default: null
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "pending"
  },
  token: {
    type: String,
    default: null
  },
  rawResponse: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);
