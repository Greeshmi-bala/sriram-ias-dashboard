const User = require("../models/User");
const ResultGS = require("../models/ResultGS");
const ResultCSAT = require("../models/ResultCSAT");

/**
 * POST /auth/verify-login
 * Body: { phone }
 * Checks ResultGS + ResultCSAT + User collections using "mobile" field
 */
const verifyLogin = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required.",
      });
    }

    // Sanitize: digits only
    const sanitizedPhone = String(phone).trim().replace(/\D/g, "");

    if (sanitizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number.",
      });
    }

    console.log(`[AUTH] Checking mobile: ${sanitizedPhone}`);

    // Search across all collections — result models use "mobile" field
    const [gsUser, csatUser, dbUser] = await Promise.all([
      ResultGS.findOne({ mobile: sanitizedPhone }).lean(),
      ResultCSAT.findOne({ mobile: sanitizedPhone }).lean(),
      User.findOne({ $or: [{ phone: sanitizedPhone }, { mobile: sanitizedPhone }] }).lean(),
    ]);

    const userData = gsUser || csatUser || dbUser;

    if (!userData) {
      console.log(`[AUTH] NOT FOUND: ${sanitizedPhone}`);
      return res.status(404).json({
        success: false,
        message: "No registered candidate found with this mobile number.",
      });
    }

    console.log(`[AUTH] ✅ Found: ${userData.name}`);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      name: userData.name,
      phone: sanitizedPhone,
    });

  } catch (error) {
    console.error("❌ verifyLogin error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = { verifyLogin };