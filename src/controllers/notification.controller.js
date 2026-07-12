import { MESSAGE } from "../constants/message.js";
import {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_PRIORITY,
} from "../constants/notification.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import { wrapAsync } from "../middlewares/error.middleware.js";
import {
  createNotification,
  fetchNotificationsForUser,
  fetchPublicNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification.service.js";
import { toResultOk } from "../results/Result.js";

export const getMyNotifications = wrapAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user?._id;
  const role = req.user?.role?.name;

  const result = await fetchNotificationsForUser({
    userId,
    role,
    page,
    limit,
  });

  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.NOTIFICATION_FETCH_SUCCESS,
      data: result.items,
      pagination: result.pagination,
      meta: {
        unread: result.unread,
      },
    })
  );
});

export const getPublicNotifications = wrapAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await fetchPublicNotifications({ page, limit });
  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.NOTIFICATION_FETCH_SUCCESS,
      data: result.items,
      pagination: result.pagination,
    })
  );
});

export const markNotificationRead = wrapAsync(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user?._id;

  const updated = await markNotificationAsRead({ notificationId, userId });

  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.NOTIFICATION_MARK_READ_SUCCESS,
      data: updated,
    })
  );
});

export const markAllNotificationsRead = wrapAsync(async (req, res) => {
  const userId = req.user?._id;
  const role = req.user?.role?.name;

  const result = await markAllNotificationsAsRead({ userId, role });

  return res.status(200).json(
    toResultOk({
      msg: MESSAGE.NOTIFICATION_MARK_ALL_SUCCESS,
      data: result,
    })
  );
});

export const createAdminNotification = wrapAsync(async (req, res) => {
  const {
    title,
    message,
    audience = NOTIFICATION_AUDIENCE.GLOBAL,
    recipientRole,
    category = NOTIFICATION_CATEGORY.SYSTEM,
    priority = NOTIFICATION_PRIORITY.INFO,
    metadata,
    action,
    expiresAt,
  } = req.body;

  if (!title || !message) {
    throw new ErrorResponse(400, MESSAGE.FIELD_REQUIRED);
  }

  if (audience === NOTIFICATION_AUDIENCE.ROLE && !recipientRole) {
    throw new ErrorResponse(400, MESSAGE.NOTIFICATION_ROLE_REQUIRED);
  }

  const notification = await createNotification({
    title,
    message,
    audience,
    recipientRole,
    category,
    priority,
    metadata,
    action,
    expiresAt,
    sender: req.user?._id,
  });

  return res.status(201).json(
    toResultOk({
      statusCode: 201,
      msg: MESSAGE.NOTIFICATION_CREATE_SUCCESS,
      data: notification,
    })
  );
});
