// app.routes.js
import express from "express";
import adminRoutes from "./admin.routes.js";
import authRoutes from "./auth.routes.js";
import candidateRoutes from "./candidate.routes.js";
import categoryRoutes from "./category.routes.js";
import companyRoutes from "./company.routes.js";
import jobRoutes from "./job.routes.js";
import publicRoutes from "./public.routes.js";
import recruiterRoutes from "./recruiter.routes.js";
import tagRoutes from "./tag.routes.js";
import uploadRoutes from "./upload.routes.js";
import notificationRoutes from "./notification.routes.js";

const appRoutes = express.Router();

// import authRoutes from './auth.routes.js';
import aiRoutes from "./ai.routes.js";
import applicationRoutes from "./application.routes.js";
import upgradeRequestRoutes from "./upgradeRequest.routes.js";
import userRoutes from "./user.routes.js";

// appRoutes.use("/auth", authRoutes);
appRoutes.use("/auth", authRoutes);

// Public routes (no auth required)
appRoutes.use("/public", publicRoutes);

appRoutes.use("/users", userRoutes);
appRoutes.use("/candidates", candidateRoutes);

appRoutes.use("/applications", applicationRoutes);
appRoutes.use("/uploads", uploadRoutes);
appRoutes.use("/notifications", notificationRoutes);

appRoutes.use("/upgrade-requests", upgradeRequestRoutes);

// Job routes
appRoutes.use("/jobs", jobRoutes);
// Tag routes
appRoutes.use("/tags", tagRoutes);
// Category routes
appRoutes.use("/categories", categoryRoutes);
// Company routes
appRoutes.use("/companies", companyRoutes);

// Admin routes
appRoutes.use("/admin", adminRoutes);
// appRoutes.use("/applications", appstatusRoutes);
appRoutes.use("/companies", companyRoutes);

// Recruiter routes
appRoutes.use("/recruiter", recruiterRoutes);

// AI routes
appRoutes.use("/ai", aiRoutes);

export default appRoutes;
