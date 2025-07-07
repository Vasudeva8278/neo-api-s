const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 7,
    },
    // role: {
    //   type: String,
    //   enum: ["user", "OrgAdmin", "SuperAdmin"],
    //   default: "user",
    // },
    role:{
      type:mongoose.Schema.Types.ObjectId,
      required:true
    },
    orgId: {
      type: String,
      default: "neo",
    },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
    features: {
      type: [String], // List of feature flags
      default: [],
    },
    resetPasswordToken: {
      type: String,
      required: false,
    },
    resetPasswordExpires: {
      type: String,
      required: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash the plain text password before saving
userSchema.pre("save", async function (next) {
  const user = this;
  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

// Generate auth token
userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign(
    { _id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  user.tokens = user.tokens.concat({ token });
  await user.save();
  return token;
};

// Find user by credentials
userSchema.statics.findByCredentials = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Invalid Email/Username");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid Password");
  }

  return user;
};

// Add default features based on role
userSchema.statics.setDefaultFeatures = async function (user) {
  const features = {
    user: ["viewDashboard", "viewProfile"],
    OrgAdmin: ["viewDashboard", "viewProfile", "manageUsers"],
    SuperAdmin: [
      "viewDashboard",
      "viewProfile",
      "manageUsers",
      "viewOrganizations",
    ],
  };

  user.features = features[user.role];
  await user.save();
  return user;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
