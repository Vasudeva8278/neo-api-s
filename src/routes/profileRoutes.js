const express = require("express");
const multer = require("multer");
const storage = multer.memoryStorage(); // Or configure for file storage on disk/cloud
const upload = multer({ storage });
const {
  createAndUpdateProfile,
  getProfile,
} = require("../controllers/profileController");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Route for creating a profile
router.post("/", auth, upload.single("profilePic"), createAndUpdateProfile);

// Route for getting a profile by userId
router.get("/", auth, getProfile);

module.exports = router;
