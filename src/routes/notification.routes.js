import express from "express";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createAdminNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";

const notificationRoutes = express.Router();

notificationRoutes.use(authMiddleware);

notificationRoutes.get("/", getMyNotifications);
notificationRoutes.patch("/read-all", markAllNotificationsRead);
notificationRoutes.patch("/:notificationId/read", markNotificationRead);
notificationRoutes.post("/", adminMiddleware, createAdminNotification);

export default notificationRoutes;
