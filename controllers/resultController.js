const ResultGS   = require("../models/ResultGS");
const ResultCSAT = require("../models/ResultCSAT");

// ─────────────────────────────────────────────
// GET /result/gs?phone=XXXXXXXXXX
// ─────────────────────────────────────────────
exports.getGS = async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim().replace(/\D/g, "");
    if (!phone || phone.length !== 10) {
      return res.status(400).json({ message: "Valid 10-digit mobile number required." });
    }

    console.log(`\n🔍 [GS] Searching for mobile: ${phone}`);
    const user = await ResultGS.findOne({ mobile: phone }).lean();

    if (!user) {
      console.log(`❌ [GS] NOT FOUND: ${phone}`);
      const sample = await ResultGS.find().limit(3).select("mobile name").lean();
      console.log("📊 [GS] Sample mobiles in DB:", sample.map(u => u.mobile));
      return res.status(404).json({ message: "GS result not found" });
    }

    const totalStudents = await ResultGS.countDocuments();
    console.log(`✅ [GS] Found: ${user.name}`);

    // ── Combine attempts if present ──────────────────────────────────────
    let combinedCorrect   = user.correct   ?? 0;
    let combinedIncorrect = user.incorrect ?? 0;
    let combinedBlank     = user.blank     ?? 0;
    let combinedScore     = user.score     ?? 0;

    if (user.attempts && user.attempts.length > 0) {
      combinedCorrect   = user.attempts.reduce((s, a) => s + (a.correct   ?? 0), 0);
      combinedIncorrect = user.attempts.reduce((s, a) => s + (a.incorrect ?? 0), 0);
      combinedBlank     = user.attempts.reduce((s, a) => s + (a.blank     ?? 0), 0);
      combinedScore     = user.attempts.reduce((s, a) => s + (a.score     ?? 0), 0);
    }

    // ── All India Rank: count students with a higher combined score ───────
    // For students WITH attempts, rank is based on sum of attempt scores.
    // For students WITHOUT attempts (legacy), rank is based on their score field.
    const allStudents = await ResultGS.find().select("score attempts").lean();

    const getCombinedScore = (s) => {
      if (s.attempts && s.attempts.length > 0) {
        return s.attempts.reduce((sum, a) => sum + (a.score ?? 0), 0);
      }
      return s.score ?? 0;
    };

    const rank = allStudents.filter(s => getCombinedScore(s) > combinedScore).length + 1;

    return res.json({
      name:         user.name,
      mobile:       user.mobile,
      centre:       user.centre || "Online",
      correct:      combinedCorrect,
      incorrect:    combinedIncorrect,
      blank:        combinedBlank,
      score:        combinedScore,
      rank,
      totalStudents,
      attempts:     user.attempts && user.attempts.length > 0 ? user.attempts : null,
    });

  } catch (error) {
    console.error("❌ [GS] Error:", error);
    return res.status(500).json({ message: "Error fetching GS result", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /result/csat?phone=XXXXXXXXXX
// ─────────────────────────────────────────────
exports.getCSAT = async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim().replace(/\D/g, "");
    if (!phone || phone.length !== 10) {
      return res.status(400).json({ message: "Valid 10-digit mobile number required." });
    }

    console.log(`\n🔍 [CSAT] Searching for mobile: ${phone}`);
    const user = await ResultCSAT.findOne({ mobile: phone }).lean();

    if (!user) {
      console.log(`❌ [CSAT] NOT FOUND: ${phone}`);
      const sample = await ResultCSAT.find().limit(3).select("mobile name").lean();
      console.log("📊 [CSAT] Sample mobiles in DB:", sample.map(u => u.mobile));
      return res.status(404).json({ message: "CSAT result not found" });
    }

    console.log(`✅ [CSAT] Found: ${user.name}`);
    return res.json({
      name:      user.name,
      mobile:    user.mobile,
      centre:    user.centre || "Online",
      correct:   user.correct,
      incorrect: user.incorrect,
      blank:     user.blank,
      score:     user.score,
      status:    user.score >= 66.67 ? "Qualified" : "Not Qualified",
    });

  } catch (error) {
    console.error("❌ [CSAT] Error:", error);
    return res.status(500).json({ message: "Error fetching CSAT result", error: error.message });
  }
};