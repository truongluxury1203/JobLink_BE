import Job from '../models/Job.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { MESSAGE } from '../constants/message.js';
import { toResultOk, toResultError } from '../results/Result.js';

// Get recruiter statistics (open jobs count, saved candidates count)
export const getRecruiterStats = async (req, res) => {
  try {
    const recruiterId = req.user._id;
    
    // Count open jobs for this recruiter
    const openJobsCount = await Job.countDocuments({ 
      recruiter: recruiterId, 
      isActive: true 
    });
    
    // Count saved candidates (applications) for this recruiter's jobs
    const recruiterJobs = await Job.find({ recruiter: recruiterId }).select('_id');
    const jobIds = recruiterJobs.map(job => job._id);
    
    const savedCandidatesCount = await Application.countDocuments({
      job: { $in: jobIds }
    });
    
    const stats = {
      openJobs: openJobsCount,
      savedCandidates: savedCandidatesCount
    };
    
    return res.status(200).json(toResultOk({
      msg: "Recruiter statistics retrieved successfully",
      data: stats
    }));
  } catch (error) {
    return res.status(500).json(toResultError({ 
      statusCode: 500, 
      msg: MESSAGE.INTERNAL_SERVER_ERROR 
    }));
  }
};

// Get recently posted jobs for recruiter
export const getRecentlyPostedJobs = async (req, res) => {
  try {
    const recruiterId = req.user._id;
    const { limit = 5 } = req.query;
    
    // Get recent jobs for this recruiter with application counts
    const jobs = await Job.find({ recruiter: recruiterId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('category', 'name')
      .populate('company', 'name')
      .lean();
    
    // Get application counts for each job
    const jobsWithStats = await Promise.all(
      jobs.map(async (job) => {
        const applicationCount = await Application.countDocuments({ job: job._id });
        
        // Calculate days remaining or expired status
        let duration;
        let status = 'Active';
        
        if (job.deadline) {
          const now = new Date();
          const deadline = new Date(job.deadline);
          const diffTime = deadline - now;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            duration = deadline.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
            status = 'Expired';
          } else {
            duration = `${diffDays} days remaining`;
          }
        } else {
          duration = 'No deadline set';
        }
        
        if (!job.isActive) {
          status = 'Inactive';
        }
        
        return {
          _id: job._id,
          title: job.title,
          jobType: job.jobType || 'Full Time',
          duration,
          status,
          applications: applicationCount,
          createdAt: job.createdAt,
          company: job.company?.name || 'Unknown Company'
        };
      })
    );
    
    return res.status(200).json(toResultOk({
      msg: "Recently posted jobs retrieved successfully",
      data: jobsWithStats
    }));
  } catch (error) {
    console.error('Error getting recently posted jobs:', error);
    return res.status(500).json(toResultError({ 
      statusCode: 500, 
      msg: MESSAGE.INTERNAL_SERVER_ERROR 
    }));
  }
};

// Get recruiter profile information
export const getRecruiterProfile = async (req, res) => {
  try {
    const recruiterId = req.user._id;
    
    // Get user information (excluding password)
    const user = await User.findById(recruiterId)
      .select('-password')
      .populate('role', 'name');
    
    if (!user) {
      return res.status(404).json(toResultError({
        statusCode: 404,
        msg: "Recruiter not found"
      }));
    }
    
    // Get profile information if exists
    let profile = await Profile.findOne({ user: recruiterId });
    
    // Combine user and profile data
    const recruiterData = {
      _id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // Profile data (if exists)
      bio: profile?.bio || '',
      location: profile?.location || '',
      social: profile?.social || {
        linkedin: '',
        twitter: '',
        facebook: '',
        instagram: ''
      }
    };
    
    return res.status(200).json(toResultOk({
      msg: "Recruiter profile retrieved successfully",
      data: recruiterData
    }));
  } catch (error) {
    console.error('Error getting recruiter profile:', error);
    return res.status(500).json(toResultError({ 
      statusCode: 500, 
      msg: MESSAGE.INTERNAL_SERVER_ERROR 
    }));
  }
};

// Update recruiter profile information
export const updateRecruiterProfile = async (req, res) => {
  try {
    const recruiterId = req.user._id;
    const {
      firstName,
      lastName,
      phoneNumber,
      username,
      bio,
      location,
      social
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json(toResultError({
        statusCode: 400,
        msg: "First name and last name are required"
      }));
    }
    
    // Check if user exists
    const user = await User.findById(recruiterId);
    if (!user) {
      return res.status(404).json(toResultError({
        statusCode: 404,
        msg: "Recruiter not found"
      }));
    }
    
    // Update user information (excluding email)
    const userUpdateData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber || '',
      username: username || ''
    };
    
    const updatedUser = await User.findByIdAndUpdate(
      recruiterId,
      userUpdateData,
      { new: true, runValidators: true }
    ).select('-password').populate('role', 'name');
    
    // Update or create profile
    let profile = await Profile.findOne({ user: recruiterId });
    
    const profileData = {
      bio: bio || '',
      location: location || '',
      social: {
        linkedin: social?.linkedin || '',
        twitter: social?.twitter || '',
        facebook: social?.facebook || '',
        instagram: social?.instagram || ''
      }
    };
    
    if (profile) {
      // Update existing profile
      profile = await Profile.findByIdAndUpdate(
        profile._id,
        profileData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      profile = new Profile({
        user: recruiterId,
        ...profileData
      });
      await profile.save();
    }
    
    // Combine updated data
    const updatedRecruiterData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phoneNumber: updatedUser.phoneNumber,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      isEmailVerified: updatedUser.isEmailVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      bio: profile.bio,
      location: profile.location,
      social: profile.social
    };
    
    return res.status(200).json(toResultOk({
      msg: "Recruiter profile updated successfully",
      data: updatedRecruiterData
    }));
  } catch (error) {
    console.error('Error updating recruiter profile:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(toResultError({
        statusCode: 400,
        msg: `Validation error: ${errors.join(', ')}`
      }));
    }
    
    return res.status(500).json(toResultError({ 
      statusCode: 500, 
      msg: MESSAGE.INTERNAL_SERVER_ERROR 
    }));
  }
};