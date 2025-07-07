const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  forgotPassword,
  getUsers,
  getOrgUsers,
  getUser,
  updateUser,
  updateUserRole,
  deleteUser,
  getUserProfile,
  logout,
  logoutAll,
  createUser,
  resetPassword,
  verifyEmail,
  googleAuthUser,
  changePassword,
  getAllUsers,

} = require("../controllers/userController");
const { auth, admin, orgAdmin } = require("../middleware/auth");

// Get user profile
router.get("/me", auth, getUserProfile);
router.put("/role/:id", auth, orgAdmin, updateUserRole);
// Sign up a new user
router.post("/signup", signup);

// Log in an existing user
router.post("/login", login);

//to use google token for authentication and authorise with app generated token
router.post("/google-auth", googleAuthUser);

// Forgot password
router.post("/forgotPassword", forgotPassword);

// Create a new user (OrgAdmin or SuperAdmin)
router.post("/createUser", auth, orgAdmin, createUser);

// Get all users (SuperAdmin only)
router.get("/", auth, admin, getUsers);



router.get("/verify-email/:token", verifyEmail);


// Get all users for an organization (OrgAdmin or SuperAdmin)
router.get("/orgUsers", auth, orgAdmin, getOrgUsers);

// Get all users for an organization (OrgAdmin or SuperAdmin)
router.get("/getalluser", getAllUsers);

// Get a specific user (OrgAdmin or SuperAdmin)
router.get("/:id", auth, orgAdmin, getUser);

// Update a user (OrgAdmin or SuperAdmin)
router.put("/update-status/:id", updateUserRole);
router.post("/reset-password/:token", resetPassword);

router.post("/change-password", auth, changePassword);

// Delete a user (OrgAdmin or SuperAdmin)
router.delete("/delete/:id", deleteUser);

// Logout user
router.post("/logout", auth, logout);

// Logout user from all devices
router.post("/logoutAll", auth, logoutAll);

module.exports = router;
