const xlsx = require("xlsx");
const User = require("../models/User");
const ResultGS = require("../models/ResultGS");
const ResultCSAT = require("../models/ResultCSAT");

// ─────────────────────────────────────────────────────────────
// POST /admin/upload
// form-data: file + type ("gs" | "csat" | blank for admit card)
// ─────────────────────────────────────────────────────────────
exports.uploadExcel = async (req, res) => {
  try {
    const file = req.file;
    const { type } = req.body;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (type === "gs") {
      return await uploadResultExcel(file, ResultGS, "GS", res);
    } else if (type === "csat") {
      return await uploadResultExcel(file, ResultCSAT, "CSAT", res);
    } else {
      return await uploadAdmitCardExcel(file, res);
    }

  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Upload GS or CSAT result Excel
// Saves with field name "mobile" (consistent across all models)
// ─────────────────────────────────────────────────────────────
async function uploadResultExcel(file, Model, typeName, res) {
  const workbook = xlsx.readFile(file.path);
  let allData = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false, range: 0 });
    data.forEach(row => allData.push({ ...row, sheetName }));
  });

  const results = allData.map((row, index) => {
    // Normalize all keys: lowercase + remove non-alphanumeric
    const cleanRow = {};
    Object.keys(row).forEach((key) => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      cleanRow[normalized] = row[key];
    });

    if (index < 3) {
      console.log(`\n📊 Row ${index} keys:`, Object.keys(cleanRow));
    }

    // Extract mobile — handles "Mob No", "Mobile", "Phone", etc.
    const rawMobile = (
      cleanRow["mobno"]       ||
      cleanRow["mobile"]      ||
      cleanRow["phone"]       ||
      cleanRow["mobileno"]    ||
      cleanRow["phonenumber"] ||
      cleanRow["phoneno"]     ||
      ""
    );
    const mobile = String(rawMobile).replace(/\D/g, "").trim();

    return {
      mobile,
      name: (
        cleanRow["candidatename"] ||
        cleanRow["name"]          ||
        cleanRow["studentname"]   ||
        ""
      ).trim(),
      centre: (
        cleanRow["centre"] ||
        cleanRow["center"] ||
        cleanRow["mode"]   ||   // "Online" / "Offline" treated as centre
        cleanRow["examcentre"] ||
        row.sheetName          ||  // fallback to sheet name
        ""
      ).trim(),
      correct:   parseInt(cleanRow["correct"]   || 0),
      incorrect: parseInt(cleanRow["incorrect"] || 0),
      blank:     parseInt(cleanRow["blank"]     || 0),
      score:     parseFloat(cleanRow["score"]   || 0),
      rank:      parseInt(cleanRow["rank"]      || 0) || null,
    };
  });

  const validResults = results.filter(r => r.mobile && r.mobile.length === 10);
  console.log(`\n✅ ${typeName} — Total: ${results.length}, Valid (10-digit): ${validResults.length}`);

  if (validResults.length === 0) {
    return res.status(400).json({
      message: "No valid 10-digit mobile numbers found. Check your Excel column headers.",
      sampleKeys: Object.keys(allData[0] || {})
    });
  }

  const operations = validResults.map(result => ({
    updateOne: {
      filter: { mobile: result.mobile },
      update: { $set: result },
      upsert: true
    }
  }));

  const dbResult = await Model.bulkWrite(operations);

  return res.json({
    message: `${typeName} results uploaded successfully ✅`,
    totalSheets: workbook.SheetNames.length,
    sheetsProcessed: workbook.SheetNames,
    totalRows: allData.length,
    validRows: validResults.length,
    inserted: dbResult.upsertedCount,
    updated: dbResult.modifiedCount,
  });
}

// ─────────────────────────────────────────────────────────────
// Upload Admit Card / User Excel (phone field)
// ─────────────────────────────────────────────────────────────
async function uploadAdmitCardExcel(file, res) {
  const workbook = xlsx.readFile(file.path);
  let allData = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false, range: 0 });
    data.forEach(row => allData.push({ ...row, sheetName }));
  });

  const users = allData.map((row) => {
    const cleanRow = {};
    Object.keys(row).forEach((key) => {
      cleanRow[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = row[key];
    });

    return {
      name:      (cleanRow["name"] || "").trim(),
      phone:     String(cleanRow["phonenumber"] || cleanRow["phone"] || cleanRow["mobno"] || "").replace(/\D/g, "").trim(),
      email:     (cleanRow["emailid"] || cleanRow["email"] || "").toLowerCase().trim(),
      city:      (cleanRow["city"] || "").trim(),
      venue:     (cleanRow["venue"] || "").trim(),
      gsSlot:    (cleanRow["generalstudiesslot"] || cleanRow["gsslot"] || "").trim(),
      csat:      (cleanRow["csat"] || cleanRow["csatslot"] || "").trim(),
      examSheet: (row.sheetName || "").trim(),
    };
  });

  const operations = users
    .filter(u => u.phone && u.phone.length === 10)
    .map(user => ({
      updateOne: {
        filter: { phone: user.phone },
        update: { $set: user },
        upsert: true
      }
    }));

  const dbResult = await User.bulkWrite(operations);

  return res.json({
    message: "Admit card data uploaded successfully ✅",
    totalSheets: workbook.SheetNames.length,
    totalRows: allData.length,
    inserted: dbResult.upsertedCount,
    updated: dbResult.modifiedCount,
  });
}

// ─────────────────────────────────────────────────────────────
// GET /admin/users
// ─────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).lean();
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /admin/search?query=...
// ─────────────────────────────────────────────────────────────
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query required" });

    const users = await User.find({
      $or: [
        { name:  { $regex: query, $options: "i" } },
        { phone: { $regex: query } },
        { email: { $regex: query, $options: "i" } },
      ]
    }).limit(50).lean();

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error searching users", error: error.message });
  }
};