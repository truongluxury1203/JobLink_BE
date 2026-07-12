import User from "../models/User.js";
import Profile from "../models/Profile.js";
import { MESSAGE } from "../constants/message.js";
import { toResultOk, toResultError } from "../results/Result.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";

export const getProfile = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate("role").select("-password");
  if (!user) {
    return res.json(toResultError({ statusCode: 404, msg: MESSAGE.USER_NOT_FOUND }));
  }

  let profileData = { ...user.toObject() };

  if (user.role.name === "candidate") {
    const candidateProfile = await Profile.findOne({ user: userId });
    if (candidateProfile) {
      profileData = { ...profileData, ...candidateProfile.toObject() };
    }
  } else if (user.role.name === "recruiter") {
    const recruiterProfile = await Profile.findOne({ user: userId });
    if (recruiterProfile) {
      profileData = { ...profileData, ...recruiterProfile.toObject() };
    }
  }

  // Format response data để match với frontend expectations
  const responseData = {
    ...profileData,
    fullName: `${profileData.firstName} ${profileData.lastName}`.trim(),
    phone: profileData.phoneNumber,
    email: profileData.email,
    // For recruiter, address comes from Profile.location, for candidate from User.address
    address: user.role.name === "recruiter" ? (profileData.location || "") : (profileData.address || "")
  };

  res.json(
    toResultOk({
      msg: MESSAGE.USER_PROFILE_FETCH_SUCCESS,
      data: responseData,
    })
  );
};

export const updateProfile = async (req, res) => {
  const userId = req.user?._id || req.params.userId;
  const { fullName, phone, address, firstName, lastName, phoneNumber, ...profileDetails } = req.body;

  const user = await User.findById(userId).populate("role");

  if (!user) {
    return res.json(toResultError({ statusCode: 404, msg: MESSAGE.USER_NOT_FOUND }));
  }

  // Handle fullName field from frontend
  if (fullName) {
    const nameParts = fullName.trim().split(' ');
    user.firstName = nameParts[0] || '';
    user.lastName = nameParts.slice(1).join(' ') || '';
  }
  
  // Update user fields (support both old and new field names)
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phoneNumber = phone;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  
  // For candidate, save address to User.address
  // For recruiter, address will be saved to Profile.location
  if (user.role.name === "candidate" && address) {
    user.address = address;
  }

  await user.save();

  // Exclude password from the response
  const userObject = user.toObject();
  delete userObject.password;

  let profileData = { ...userObject };

  if (user.role.name === "candidate") {
    const { profile, avatar, experience_years, skills, cv, social } = profileDetails;
    const candidateProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { profile, avatar, experience_years, skills, cv, social },
      { new: true, upsert: true }
    );
    if (candidateProfile) {
      profileData = { ...profileData, ...candidateProfile.toObject() };
    }
  } else if (user.role.name === "recruiter") {
    const { position, social } = profileDetails;
    // For recruiter, save address to Profile.location
    const updateData = { position, social };
    if (address) {
      updateData.location = address;
    }
    
    const recruiterProfile = await Profile.findOneAndUpdate(
      { user: userId },
      updateData,
      { new: true, upsert: true }
    );
    if (recruiterProfile) {
      profileData = { ...profileData, ...recruiterProfile.toObject() };
    }
  }

  // Format response data để match với frontend expectations
  const responseData = {
    ...profileData,
    fullName: `${profileData.firstName} ${profileData.lastName}`.trim(),
    phone: profileData.phoneNumber,
    email: profileData.email,
    // For recruiter, address comes from Profile.location, for candidate from User.address
    address: user.role.name === "recruiter" ? (profileData.location || "") : (profileData.address || "")
  };

  res.json(
    toResultOk({
      msg: MESSAGE.USER_PROFILE_UPDATE_SUCCESS,
      data: responseData,
    })
  );
};

export const getUserById = async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).populate("role").select("-password");
  if (!user) {
    return res.json(toResultError({ statusCode: 404, msg: MESSAGE.USER_NOT_FOUND }));
  }

  // In a real app, you might want to check if the requester is an admin here.
  let profileData = { ...user.toObject() };

  if (user.role.name === "candidate") {
    const candidateProfile = await Profile.findOne({ user: id });
    if (candidateProfile) {
      profileData = { ...profileData, ...candidateProfile.toObject() };
    }
  } else if (user.role.name === "recruiter") {
    const recruiterProfile = await Profile.findOne({ user: id });
    if (recruiterProfile) {
      profileData = { ...profileData, ...recruiterProfile.toObject() };
    }
  }

  // Format response data để match với frontend expectations
  const responseData = {
    ...profileData,
    fullName: `${profileData.firstName} ${profileData.lastName}`.trim(),
    phone: profileData.phoneNumber,
    email: profileData.email,
    // For recruiter, address comes from Profile.location, for candidate from User.address
    address: user.role.name === "recruiter" ? (profileData.location || "") : (profileData.address || "")
  };

  res.json(
    toResultOk({
      msg: MESSAGE.USER_PROFILE_FETCH_SUCCESS,
      data: responseData,
    })
  );
};

export const getMe = async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId).populate("role").select("-password");
  if (!user) throw new ErrorResponse(404, MESSAGE.USER_NOT_FOUND);
  
  let profileData = { ...user.toObject() };

  if (user.role.name === "candidate") {
    const candidateProfile = await Profile.findOne({ user: userId });
    if (candidateProfile) {
      profileData = { ...profileData, ...candidateProfile.toObject() };
    }
  } else if (user.role.name === "recruiter") {
    const recruiterProfile = await Profile.findOne({ user: userId });
    if (recruiterProfile) {
      profileData = { ...profileData, ...recruiterProfile.toObject() };
    }
  }

  // Format response data để match với frontend expectations
  const responseData = {
    ...profileData,
    fullName: `${profileData.firstName} ${profileData.lastName}`.trim(),
    phone: profileData.phoneNumber,
    email: profileData.email,
    // For recruiter, address comes from Profile.location, for candidate from User.address
    address: user.role.name === "recruiter" ? (profileData.location || "") : (profileData.address || "")
  };
  
  res.json(toResultOk({ data: responseData }));
};
