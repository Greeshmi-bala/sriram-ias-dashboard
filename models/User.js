const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:      String,
  phone:     String,   // Primary login identifier
  email:     String,   // Optional — no longer required for login
  city:      String,

  // Multi-sheet support fields
  venue:     String,
  gsSlot:    String,   // General Studies slot
  csat:      String,   // CSAT slot
  examSheet: String,   // Sheet name (e.g., "PUNE SLOT 1")
});

module.exports = mongoose.model("User", userSchema);