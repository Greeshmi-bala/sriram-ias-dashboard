const express = require("express");
const { verifyLogin } = require("../controllers/authController");

const router = express.Router();

// Login verification endpoint (phone only)
router.post("/verify-login", verifyLogin);

module.exports = router;