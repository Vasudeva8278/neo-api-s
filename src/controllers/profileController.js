const Profile = require("../models/profileModel");
const User = require("../models/userModel"); // Assuming the User model exists
const { uploadToS3 } = require("../services/fileService");

// Create Profile Controller
const createAndUpdateProfile = async (req, res) => {
  const userId = req.user._id;
  try {
    const { firstName, lastName, gender, address, dateOfBirth, mobile } =
      req.body;
    const profilePic = req.file;

    if (
      !userId ||
      !firstName ||
      !lastName ||
      !gender ||
      !address ||
      !dateOfBirth ||
      !mobile
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if profile already exists for the user
    let profile = await Profile.findOne({ userId });

    const addressParts = address.split(",").map((part) => part.trim());

    const formattedAddress = {
      street: addressParts[0] || "",
      city: addressParts[1] || "",
      state: addressParts[2] || "",
      postalCode: addressParts[3] || "",
      country: addressParts[4] || "",
    };
    let profilePicUrl;
    if (profilePic) {
      // Upload profile picture to S3
      const fileName = `profile-pics/${userId}-${Date.now()}.jpg`; // Set a unique key for the image
      profilePicUrl = await uploadToS3(
        profilePic.buffer,
        fileName,
        profilePic.mimetype
      ); // Upload to S3 and get the URL
      console.log(profilePicUrl);
    }
    if (profile) {
      // Update the existing profile
      profile.firstName = firstName;
      profile.lastName = lastName;
      profile.gender = gender;
      profile.address = formattedAddress;
      profile.mobile = mobile;
      profile.dateOfBirth = dateOfBirth;
      // Retain existing profilePic if not provided
      if (profilePic && profilePicUrl) {
        profile.profilePic = profilePicUrl;
      }
      await profile.save();
      return res
        .status(200)
        .json({ message: "Profile updated successfully", profile });
    } else {
      // Create new profile
      profile = new Profile({
        userId,
        firstName,
        lastName,
        gender,
        formattedAddress,
        dateOfBirth,
        mobile,
        profilePic: profilePic && profilePicUrl ? profilePicUrl : "", // Use default if not provided
      });

      await profile.save();
      return res
        .status(201)
        .json({ message: "Profile created successfully", profile });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

// Get Profile Controller
const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("getProfile ", userId);

    // Validate userId
    if (!userId) {
      return res.status(400).json({ error: "User not authenticated" });
    }

    // Find the profile by userId
    const profile = await Profile.findOne({ userId }).populate(
      "userId",
      "email"
    ); // Populate specific fields from User model

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const email = profile.userId.email;
    // Convert address object to a formatted string
    const { street, city, state, postalCode, country } = profile.address;
    const addressString = `${street}, ${city}, ${state}, ${postalCode}, ${country}`;

    const profileObj = {
      ...profile.toObject(), // Convert Mongoose document to plain object
      email, // Add email field
      address: addressString, // Overwrite address field with formatted string
    };

    console.log(profileObj);

    return res.status(200).json({ profile: profileObj });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

module.exports = {
  createAndUpdateProfile,
  getProfile,
};
