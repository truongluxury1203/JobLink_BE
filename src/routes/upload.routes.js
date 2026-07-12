import express from "express";
import {
  addCandidateCv,
  deleteCandidateCv,
  getCandidateCv,
  updateCandidateCv,
  addUserAvatar,
  deleteUserAvatar,
  getUserAvatar,
  updateUserAvatar,
} from "../controllers/upload.controller.js";
import upload from "../lib/cloudinary/multer.js";
import { wrapAsync } from "../middlewares/error.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const uploadRoutes = express.Router();
uploadRoutes.use(authMiddleware);
uploadRoutes.get("/cv/:userId", wrapAsync(getCandidateCv));
uploadRoutes.post("/cv/:userId", upload.single("cv"), wrapAsync(addCandidateCv));
uploadRoutes.put("/cv/:userId", upload.single("cv"), wrapAsync(updateCandidateCv));
uploadRoutes.delete("/cv/:userId", wrapAsync(deleteCandidateCv));

uploadRoutes.get("/avatar/:userId", wrapAsync(getUserAvatar));
uploadRoutes.post("/avatar/:userId", upload.single("avatar"), wrapAsync(addUserAvatar));
uploadRoutes.put("/avatar/:userId", upload.single("avatar"), wrapAsync(updateUserAvatar));
uploadRoutes.delete("/avatar/:userId", wrapAsync(deleteUserAvatar));

export default uploadRoutes;
