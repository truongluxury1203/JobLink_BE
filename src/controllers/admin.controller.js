import Category from "../models/Category.js";
import Company from "../models/Company.js";
import Job from "../models/Job.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

// Ban/Unban user account
export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }
    const { isActive } = req.body;

    // Validate input
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user's isActive status (match current schema)
    user.isActive = isActive;
    await user.save();

    const action = isActive ? "unbanned" : "banned";
    res.status(200).json({
      success: true,
      message: `User has been ${action} successfully`,
      data: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Error banning user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }
    const { roleId } = req.body;

    console.log("Update role request:", { userId, roleId });

    // Validate input
    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "roleId is required",
      });
    }

    // Check if role exists
    const role = await Role.findById(roleId);
    console.log("Found role:", role);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Find user by ID
    const user = await User.findById(userId);
    console.log("Found user:", user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user's role (match current schema)
    user.role = roleId;
    await user.save();

    console.log("User updated successfully:", user);

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.role,
        roleName: role.name,
      },
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all users (for admin to view) with pagination
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
    
    // Build query
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    
    // Role filter
    if (role) {
      const roleDoc = await Role.findOne({ name: role });
      if (roleDoc) {
        query.role = roleDoc._id;
      }
    }
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    
    const users = await User.find(query)
      .populate("role", "name")
      .select("-password")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all roles
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();

    res.status(200).json({
      success: true,
      message: "Roles retrieved successfully",
      data: roles,
    });
  } catch (error) {
    console.error("Error getting roles:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate("role", "name")
      .select("-password"); // Exclude password from response

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all jobs (for admin) with pagination - aligned with current Job schema
export const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    
    // Build query
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Job.countDocuments(query);
    
    const jobs = await Job.find(query)
      .populate("company", "name")
      .populate("category", "name")
      .populate({ path: "recruiter", select: "firstName lastName email" })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Jobs retrieved successfully",
      data: jobs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting jobs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Toggle job visibility (active/inactive)
export const toggleJobVisibility = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    job.isActive = !job.isActive;
    await job.save();

    res.status(200).json({
      success: true,
      message: `Job is now ${job.isActive ? "active" : "inactive"}`,
      data: { jobId: job._id, isActive: job.isActive },
    });
  } catch (error) {
    console.error("Error toggling job visibility:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a job
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByIdAndDelete(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
      data: { jobId: job._id },
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get overview statistics
export const getOverviewStats = async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const bannedUsers = await User.countDocuments({ isActive: false });
    
    // Get upgrade request statistics
    const UpgradeRequest = (await import("../models/UpgradeRequest.js")).default;
    const totalUpgradeRequests = await UpgradeRequest.countDocuments();
    const pendingRequests = await UpgradeRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await UpgradeRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await UpgradeRequest.countDocuments({ status: 'rejected' });
    
    // Get job statistics
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ isActive: true });
    const inactiveJobs = await Job.countDocuments({ isActive: false });
    
    // Get company statistics
    const totalCompanies = await Company.countDocuments();

    res.status(200).json({
      success: true,
      message: "Overview statistics retrieved successfully",
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
        },
        upgradeRequests: {
          total: totalUpgradeRequests,
          pending: pendingRequests,
          approved: approvedRequests,
          rejected: rejectedRequests,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
          inactive: inactiveJobs,
        },
        companies: {
          total: totalCompanies,
        },
      },
    });
  } catch (error) {
    console.error("Error getting overview stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user registration statistics by month
export const getUserRegistrationStats = async (req, res) => {
  try {
    // Get year from query params or use current year
    const year = req.query?.year ? parseInt(req.query.year) : new Date().getFullYear();
    const monthlyStats = [];

    // Get stats for each month (1-12)
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      const count = await User.countDocuments({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      });

      monthlyStats.push({
        month: month,
        monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }),
        count: count,
      });
    }

    res.status(200).json({
      success: true,
      message: "User registration statistics retrieved successfully",
      data: monthlyStats,
    });
  } catch (error) {
    console.error("Error getting user registration stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get public stats for home page (no auth required)
export const getPublicStats = async (req, res) => {
  try {
    // Count active jobs
    const activeJobsCount = await Job.countDocuments({ isActive: true });
    
    // Count total companies
    const companiesCount = await Company.countDocuments({});
    
    // Count candidate users
    const candidateRole = await Role.findOne({ name: "candidate" });
    const candidatesCount = await User.countDocuments({ 
      role: candidateRole?._id 
    });
    
    // Count jobs created in current month (new jobs)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newJobsCount = await Job.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    res.status(200).json({
      success: true,
      message: "Public stats retrieved successfully",
      data: {
        liveJobs: activeJobsCount,
        companies: companiesCount,
        candidates: candidatesCount,
        newJobs: newJobsCount,
      },
    });
  } catch (error) {
    console.error("Error getting public stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
