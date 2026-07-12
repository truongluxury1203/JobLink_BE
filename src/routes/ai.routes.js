// auth.routes.js
import express from "express";
import { aiCandidateMiddleware } from "../middlewares/ai.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { wrapAsync } from "../middlewares/error.middleware.js";
import { aiCandidateController } from "../controllers/ai.controller.js";
const aiRoutes = express.Router();
// Truy vấn ai
aiRoutes.post(
  "/candidate/query",
  authMiddleware,
  aiCandidateMiddleware,
  wrapAsync(aiCandidateController)
);

export default aiRoutes;
