const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema({
  centre:    String,
  correct:   Number,
  incorrect: Number,
  blank:     Number,
  score:     Number,
}, { _id: false });

const resultSchema = new mongoose.Schema({
  mobile:    { type: String, required: true },
  name:      String,
  centre:    String,       // kept for backward compat (primary centre)
  correct:   Number,       // combined total
  incorrect: Number,       // combined total
  blank:     Number,       // combined total
  score:     Number,       // combined total score
  rank:      Number,
  attempts:  [attemptSchema],   // ← each online/offline attempt
  timestamp: { type: Date, default: Date.now }
});

resultSchema.index({ mobile: 1 });

module.exports = mongoose.model("ResultGS", resultSchema);