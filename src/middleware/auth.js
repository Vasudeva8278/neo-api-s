const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Define your role IDs at the top of the file
const ADMIN_ROLE_ID = "685f9b7d3d988647b344e5ca";
const NEO_EXPERT_ROLE_ID = "68621581db15fbb9bbd2f836";
const NEO_EXECUTIVE_ROLE_ID = "68621597db15fbb9bbd2f838";
// If you have a SuperAdmin, add its ID here as well

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded._id,
      "tokens.token": token,
    });

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;

    req.userId = user._id;
    console.log("here in auth", req.userId);

    next();
  } catch (err) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

const admin = (req, res, next) => {
  if (req.user.role !== "SuperAdmin") {
    return res
      .status(403)
      .json({ message: "Access denied. SuperAdmins only." });
  }
  next();
};

const orgAdmin = (req, res, next) => {
  // Handle both string and object
  let roleId = req.user.role;
  if (typeof roleId === 'object' && roleId._id) {
    roleId = roleId._id.toString();
  } else if (typeof roleId !== 'string') {
    roleId = roleId.toString();
  }
  console.log("req.user.role:", req.user.role, "roleId:", roleId, "ADMIN_ROLE_ID:", ADMIN_ROLE_ID);
  if (roleId !== ADMIN_ROLE_ID) {
    return res
      .status(403)
      .json({ message: "Access denied. Admins only." });
  }
  next();
};

module.exports = {
  auth,
  admin,
  orgAdmin,
};
