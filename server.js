const express = require("express");
const path = require("path");

const app = express(); // ✅ SIRF EK BAAR

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend files
app.use(express.static(__dirname));

// Default route → login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Test backend route
app.get("/health", (req, res) => {
  res.send("Backend running");
});

// Server start
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
let currentOTP = null;

app.post("/send-otp", (req, res) => {
  const otp = Math.floor(10000 + Math.random() * 90000); // 5 digit
  currentOTP = otp;

  console.log("OTP is:", otp); // 👈 YAHI OTP AAYEGA

  res.json({ success: true, message: "OTP sent (check console)" });
});

app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (otp == currentOTP) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid OTP" });
  }
});
