// src/routes/user.routes.js
import express from "express";
import { getProfile, updateProfile, getUserById, getMe } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { wrapAsync } from '../middlewares/error.middleware.js';

const router = express.Router();
// router.use(authMiddleware);

// @route   GET /api/users/profile
// @desc    Get current user's profile
// @access  Private
router.get("/profile/:userId", wrapAsync(getProfile));

// @route   PUT /api/users/profile
// @desc    Update current user's profile
// @access  Private
router.put("/profile/:userId", wrapAsync(updateProfile));

// @route   GET /api/users/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", authMiddleware, wrapAsync(getMe));

// @route   GET /api/users/:id
// @desc    Get user profile by ID (for admins)
// @access  Private (should be Admin)
// Note: We should add an isAdmin middleware here in a real application
router.get("/:id", wrapAsync(getUserById));

export default router;
