const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");

const { getGS, getCSAT } = require("../controllers/resultController");

// Multer setup
const upload = multer({ dest: "uploads/" });

// Existing routes
router.get("/gs", getGS);
router.get("/csat", getCSAT);

// ✅ NEW: Excel Upload Route
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        console.log("Uploaded Data:", data);

        res.json({
            message: "File uploaded successfully",
            data: data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;