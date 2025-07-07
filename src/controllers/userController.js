const User = require("../models/userModel");
const Organization = require("../models/organizationModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logActivity = require("../middleware/logActivity");
const { sendEmail } = require("../utils/helper");
const { OAuth2Client } = require("google-auth-library");
const ejs = require("ejs");
const profileModel = require("../models/profileModel");

const getAllUsers = async (req, res) => {
  try {
    
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve users: ${err.message}`);
    res.status(500).json({ message: "Failed to retrieve users", error: err.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.role = role;
    await user.save();
    res.json(user);
  } catch (err) { 
    console.error(`[ERROR] Failed to update user: ${err.message}`);
    res.status(500).json({ message: "Failed to update user", error: err.message });
  }
};

const signup = async (req, res) => {
  console.log(req.body)
  //const { user: userDetails, organization: orgDetails } = req.body;
  const { user: userDetails } = req.body;
  /* const organization = new Organization({ 
     ...orgDetails, 
     status: 'New', 
     'subscription.plan': orgDetails.subscriptionPlan 
   });
   await organization.save(); */

  //const user = new User({ ...userDetails, orgId: organization._id, role: 'user' });
  /* const user = new User({ ...userDetails,  role: 'user' });
    await user.save();

    //await User.setDefaultFeatures(user);

    const token = await user.generateAuthToken();
    await logActivity('signup', `User ${user.email}`)(req, res, () => {});
    console.log(`[INFO] User ${user.email} signed up successfully`);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(`[ERROR] Failed to sign up user: ${err.message}`);
    res.status(400).json({ message: 'Failed to sign up user', error: err.message });
  }*/
  try {
    const existingUser = await User.findOne({ email: userDetails.email });
    if (existingUser && existingUser.emailVerified) {
      console.warn(`[WARN] Email already registered: ${userDetails.email}`);
      return res
        .status(400)
        .json({ message: "Email is already registered. Please log in." });
    }

    const verificationToken = jwt.sign(
      { _id: userDetails.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    let user;

    if (existingUser) {
      userDetails.password = await bcrypt.hash(userDetails.password, 8);
      console.log(userDetails);
      user = await User.findOneAndUpdate(
        { email: userDetails.email },
        { ...userDetails, role: "user", verificationToken },
        { new: true } // Return the updated user
      );
    } else {
      // Create a new user
      user = new User({
        ...userDetails,
        verificationToken,
      });
      await user.save();
    }
    const verificationUrl = `${process.env.FRONTEND_URL}/#/verifyEmail?token=${verificationToken}`;

    if (user.email) {
      let messageHtml = await ejs.renderFile(
        process.cwd() + "/src/views/verifyemail.ejs",
        { email: user.email, user: user.name, url: verificationUrl },
        { async: true }
      );
      // Send email with verification link
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email",
        text: messageHtml,
        html: messageHtml,
      });
    }
    console.log(`[INFO] Verification email sent to ${user.email}`);
    res
      .status(201)
      .json({ message: "Signup successful. Please verify your email.", user });
  } catch (err) {
    console.error(`[ERROR] Failed to sign up user: ${err.message}`);
    res
      .status(400)
      .json({ message: "Failed to sign up user", error: err.message });
  }
};

const verifyEmail = async (req, res) => {
  // Accept token from either params or query
  const token = req.params.token || req.query.token;
  if (!token) {
    return res.status(400).json({ message: "No token provided." });
  }

  try {
    // Find user by verificationToken
    let user = await User.findOne({ verificationToken: token });

    // If not found, check if already verified
    if (!user) {
      user = await User.findOne({ emailVerified: true, verificationToken: { $exists: false } });
      if (user) {
        return res.status(200).json({ message: "Email already verified. You can now log in." });
      }
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Mark as verified
    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (err) {
    console.error(`[ERROR] Email verification failed: ${err.message}`);
    res.status(500).json({ message: "Email verification failed", error: err.message });
  }
};

// Admin or OrgAdmin creates a new user
const createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    await User.setDefaultFeatures(user);

    await logActivity(
      "createUser",
      `Admin ${req.user.email} created user ${user.email}`
    )(req, res, () => {});
    console.log(
      `[INFO] Admin ${req.user.email} created user ${user.email} successfully`
    );
    res.status(201).json(user);
  } catch (err) {
    console.error(`[ERROR] Failed to create user: ${err.message}`);
    res
      .status(400)
      .json({ message: "Failed to create user", error: err.message });
  }
};

// Log in an existing user
const login = async (req, res) => {
  try {
    let user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );

    if (!user.emailVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email to log in." });
    }

    // Populate role if it's a reference
    user = await User.findById(user._id).populate('role', '_id name');
    

    // Print the user's role name to the server console
    console.log('[LOGIN] User role name:', user.role?.name);

    const token = await user.generateAuthToken();

    await logActivity("login", `User ${user.email} logged in`)(
      req,
      res,
      () => {}
    );
    console.log(`[INFO] User ${user.email} logged in successfully`);
    res.json({ user, token });
  } catch (err) {
    console.error(`[ERROR] Failed to login user: ${err.message}`);
    res.status(400).json({
      message: err.message ? err.message : "Unable to login. Please try later",
      error: err.message,
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = jwt.sign(
      { _id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/#/resetPassword?token=${resetToken}`;

    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/resetpwd.ejs",
      { email: user.email, user: user.name, url: resetLink },
      { async: true }
    );

    const emailSubject = "Password Reset";

    const mailRes = await sendEmail({
      to: user.email,
      subject: emailSubject,
      html: messageHtml,
    });

    if (mailRes.accepted.length > 0) {
      console.log(`[INFO] Password reset email sent to ${user.email}`);
      res.json({ success: true, message: "Password reset email sent" });
    } else {
      console.log(
        `[INFO] Failed to send password reset email  to ${user.email} `
      );
      res.json({ success: false, message: "Email failed to send." });
    }
  } catch (err) {
    console.error(
      `[ERROR] Failed to send password reset email: ${err.message}`
    );
    res.status(500).json({
      message: "Failed to send password reset email",
      error: err.message,
    });
  }
};

// Get all users (SuperAdmin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.find().populate("orgId");
    console.log(`[INFO] SuperAdmin ${req.user.email} retrieved all users`);
    res.json(users);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve users: ${err.message}`);
    res
      .status(500)
      .json({ message: "Failed to retrieve users", error: err.message });
  }
};

// Get all users for an organization (OrgAdmin or SuperAdmin)
const getOrgUsers = async (req, res) => {
  try {
    const users = await User.find({ orgId: req.user.orgId }).populate("orgId");
    console.log(
      `[INFO] OrgAdmin ${req.user.email} retrieved users for organization ${req.user.orgId}`
    );
    res.json(users);
  } catch (err) {
    console.error(
      `[ERROR] Failed to retrieve users for organization ${req.user.orgId}: ${err.message}`
    );
    res
      .status(500)
      .json({ message: "Failed to retrieve users", error: err.message });
  }
};

// Get a specific user (OrgAdmin or SuperAdmin)
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("orgId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`[INFO] Retrieved user ${user.email}`);
    res.json(user);
  } catch (err) {
    console.error(
      `[ERROR] Failed to retrieve user ${req.params.id}: ${err.message}`
    );
    res
      .status(500)
      .json({ message: "Failed to retrieve user", error: err.message });
  }
};

// Update a user (OrgAdmin or SuperAdmin)
const updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    await logActivity("updateUser", `User ${updatedUser.email} updated`)(
      req,
      res,
      () => {}
    );
    console.log(`[INFO] Updated user ${updatedUser.email}`);
    res.json(updatedUser);
  } catch (err) {
    console.error(
      `[ERROR] Failed to update user ${req.params.id}: ${err.message}`
    );
    res
      .status(400)
      .json({ message: "Failed to update user", error: err.message });
  }
};

// Delete a user (OrgAdmin or SuperAdmin)
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    await logActivity("deleteUser", `User ${deletedUser.email} deleted`)(
      req,
      res,
      () => {}
    );
    console.log(`[INFO] Deleted user ${deletedUser.email}`);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(
      `[ERROR] Failed to delete user ${req.params.id}: ${err.message}`
    );
    res
      .status(500)
      .json({ message: "Failed to delete user", error: err.message });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  const user = req.user;
  console.log(`[INFO] Retrieved profile for user ${req.user.email}`);
  const profile = await profileModel.findOne({ userId: user._id });
  const updatedUserData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    features: user.features,
    emailVerified: user.emailVerified,
    profilePic: profile?.profilePic || null, // Append profilePic from profile
  };
  res.json(updatedUserData);
};

// Logout user
const logout = async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(
      (token) => token.token !== req.token
    );
    await req.user.save();
    await logActivity("logout", `User ${req.user.email} logged out`)(
      req,
      res,
      () => {}
    );
    console.log(`[INFO] User ${req.user.email} logged out`);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(
      `[ERROR] Failed to logout user ${req.user.email}: ${err.message}`
    );
    res
      .status(500)
      .json({ message: "Failed to logout user", error: err.message });
  }
};

// Logout user from all devices
const logoutAll = async (req, res) => {
  try {
    req.user.tokens = [];
    await req.user.save();
    await logActivity(
      "logoutAll",
      `User ${req.user.email} logged out from all devices`
    )(req, res, () => {});
    console.log(`[INFO] User ${req.user.email} logged out from all devices`);
    res.json({ message: "Logged out from all devices" });
  } catch (err) {
    console.error(
      `[ERROR] Failed to logout user ${req.user.email} from all devices: ${err.message}`
    );
    res.status(500).json({
      message: "Failed to logout user from all devices",
      error: err.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token is invalid or has expired" });
    }

    user.password = req.body.password; // Ensure to hash the password
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password has been reset" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming user ID is added to req.user after authentication
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Both current and new passwords are required." });
    }

    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Check new password strength
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters long." });
    }

    // Update the password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Error in changePassword:", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
};

const googleAuthUser = async (req, res) => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  console.log("in googleAutherUser");
  const { idToken } = req.body;
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload(); // User info from Google
    const { sub, email, name, picture } = payload;

    //console.log("Google User Info:", payload);

    // Check if user already exists in your database
    let user = await User.findOne({ email: email });

    if (!user) {
      const randomPassword = generateRandomPassword();
      // If not, create a new user
      user = new User({
        name: name,
        email: email,
        role: "user",
        emailVerified: true,
        password: randomPassword,
      });
      await user.save();
    }
    const token = await user.generateAuthToken();
    /* 
    await logActivity("login", `User ${user.email} logged in`)(
      req,
      res,
      () => {}
    ); */
    console.log(`[INFO] User ${user.email} logged in successfully`);
    res.json({ user, token });
  } catch (error) {
    console.error("Google verification failed", error);
    res.status(401).json({ message: "Google verification failed" });
  }
};

function generateRandomPassword(length = 8) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }
  return password;
}

module.exports = {
  signup,
  login,
  forgotPassword,
  changePassword,
  createUser,
  getUsers,
  getOrgUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserProfile,
  logout,
  logoutAll,
  resetPassword,
  verifyEmail,
  googleAuthUser,
  updateUserRole,
  getAllUsers
  
};
