import express from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createUpgradeRequest,
  getMyUpgradeRequest,
} from "../controllers/upgradeRequest.controller.js";

const upgradeRequestRoutes = express.Router();

// Configure multer to store files in memory (as buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Apply auth middleware to all routes
upgradeRequestRoutes.use(authMiddleware);

// User routes
upgradeRequestRoutes.post("/", upload.single("businessLicense"), createUpgradeRequest);
upgradeRequestRoutes.get("/my-request", getMyUpgradeRequest);

export default upgradeRequestRoutes;
