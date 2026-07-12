import express from "express";
import {
  banUser,
  deleteJob,
  getAllJobs,
  getAllRoles,
  getAllUsers,
  getUserById,
  toggleJobVisibility,
  updateUserRole,
  getOverviewStats,
  getUserRegistrationStats,
} from "../controllers/admin.controller.js";
import {
  getAllUpgradeRequests,
  getUpgradeRequestById,
  reviewUpgradeRequest,
  getUpgradeRequestStats,
} from "../controllers/upgradeRequest.controller.js";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const adminRoutes = express.Router();

// Apply admin middleware to all routes
adminRoutes.use(authMiddleware, adminMiddleware);

// User management routes
adminRoutes.get("/users", getAllUsers); // GET /api/admin/users
adminRoutes.get("/users/:userId", getUserById); // GET /api/admin/users/:userId
adminRoutes.put("/users/:userId/ban", banUser); // PUT /api/admin/users/:userId/ban
adminRoutes.put("/users/:userId/role", updateUserRole); // PUT /api/admin/users/:userId/role

// Role management routes
adminRoutes.get("/roles", getAllRoles); // GET /api/admin/roles

// Job management routes
adminRoutes.get("/jobs", getAllJobs); // GET /api/admin/jobs
adminRoutes.put("/jobs/:jobId/toggle", toggleJobVisibility); // PUT /api/admin/jobs/:jobId/toggle
adminRoutes.delete("/jobs/:jobId", deleteJob); // DELETE /api/admin/jobs/:jobId

// Upgrade request management routes
adminRoutes.get("/upgrade-requests", getAllUpgradeRequests); // GET /api/admin/upgrade-requests
adminRoutes.get("/upgrade-requests/:requestId", getUpgradeRequestById); // GET /api/admin/upgrade-requests/:requestId
adminRoutes.put("/upgrade-requests/:requestId/review", reviewUpgradeRequest); // PUT /api/admin/upgrade-requests/:requestId
adminRoutes.get("/upgrade-requests-stats", getUpgradeRequestStats); // GET /api/admin/upgrade-requests-stats

// Overview statistics routes
adminRoutes.get("/overview-stats", getOverviewStats); // GET /api/admin/overview-stats
adminRoutes.get("/user-registration-stats", getUserRegistrationStats); // GET /api/admin/user-registration-stats

export default adminRoutes;
