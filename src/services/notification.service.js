import Notification from "../models/Notification.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import { MESSAGE } from "../constants/message.js";
import {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_DEFAULT_LIMIT,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
} from "../constants/notification.js";
import { emitNotificationEvent } from "../lib/socket/index.js";

const mapMetadata = (metadata) => {
  if (!metadata) return {};
  if (metadata instanceof Map) {
    return Object.fromEntries(metadata.entries());
  }
  if (typeof metadata.toObject === "function") {
    return metadata.toObject();
  }
  return { ...metadata };
};

const resolveFullName = (user) => {
  if (!user) return null;
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  return `${firstName} ${lastName}`.trim() || null;
};

const normalizeUser = (user) => {
  if (!user) return null;
  const roleName = user.role?.name || user.role || null;
  return {
    id: user._id?.toString() || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    fullName: resolveFullName(user),
    role: roleName,
    avatar: user.avatar || null,
  };
};

const isNotificationRead = (notification, userId) => {
  if (!notification) return false;
  if (!userId) {
    return notification.audience !== NOTIFICATION_AUDIENCE.DIRECT
      ? false
      : notification.status === NOTIFICATION_STATUS.READ;
  }
  if (notification.audience === NOTIFICATION_AUDIENCE.DIRECT) {
    return notification.status === NOTIFICATION_STATUS.READ;
  }
  return (notification.seenBy || []).some((id) => id?.toString() === userId.toString());
};

const toClientPayload = (notification, currentUserId = null) => {
  if (!notification) return null;
  const metadata = mapMetadata(notification.metadata);

  return {
    id: notification._id?.toString(),
    title: notification.title,
    message: notification.message,
    category: notification.category,
    priority: notification.priority,
    audience: notification.audience,
    recipientRole: notification.recipientRole || null,
    recipientId:
      notification.recipient?._id?.toString?.() || notification.recipient?.toString() || null,
    sender: normalizeUser(notification.sender),
    metadata,
    action: notification.action || null,
    isRead: isNotificationRead(notification, currentUserId),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

const withExpiryFilter = () => ({
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const createNotification = async (
  {
    title,
    message,
    category = NOTIFICATION_CATEGORY.SYSTEM,
    priority = NOTIFICATION_PRIORITY.INFO,
    audience = NOTIFICATION_AUDIENCE.GLOBAL,
    recipient,
    recipientRole,
    sender,
    metadata,
    action,
    expiresAt,
  },
  { silent = false } = {}
) => {
  const notification = await Notification.create({
    title,
    message,
    category,
    priority,
    audience,
    recipient,
    recipientRole,
    sender,
    metadata,
    action,
    expiresAt,
  });

  const populated = await Notification.findById(notification._id)
    .populate({ path: "sender", select: "firstName lastName avatar role" })
    .populate({ path: "recipient", select: "firstName lastName role" });

  const payload = toClientPayload(populated, populated.recipient?._id || null);

  if (!silent) {
    emitNotificationEvent(payload);
  }

  return payload;
};

export const notifyUser = async ({ userId, senderId, ...rest }) => {
  if (!userId) return null;
  return createNotification(
    {
      audience: NOTIFICATION_AUDIENCE.DIRECT,
      recipient: userId,
      sender: senderId,
      ...rest,
    },
    { silent: false }
  );
};

export const notifyRole = async ({ role, senderId, ...rest }) => {
  if (!role) return null;
  return createNotification(
    {
      audience: NOTIFICATION_AUDIENCE.ROLE,
      recipientRole: role,
      sender: senderId,
      ...rest,
    },
    { silent: false }
  );
};

export const notifySystem = async ({ senderId, ...rest }) =>
  createNotification(
    {
      audience: NOTIFICATION_AUDIENCE.GLOBAL,
      sender: senderId,
      ...rest,
    },
    { silent: false }
  );

export const fetchNotificationsForUser = async ({
  userId,
  role,
  page = 1,
  limit = NOTIFICATION_DEFAULT_LIMIT,
}) => {
  const numericPage = Math.max(1, Number(page) || 1);
  const numericLimit = Math.max(1, Math.min(Number(limit) || NOTIFICATION_DEFAULT_LIMIT, 100));

  const filters = [{ audience: NOTIFICATION_AUDIENCE.GLOBAL }];
  if (role) {
    filters.push({ audience: NOTIFICATION_AUDIENCE.ROLE, recipientRole: role });
  }
  if (userId) {
    filters.push({ audience: NOTIFICATION_AUDIENCE.DIRECT, recipient: userId });
  }

  const query = {
    $and: [{ $or: filters }, withExpiryFilter()],
  };

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .populate({ path: "sender", select: "firstName lastName avatar role" })
      .populate({ path: "recipient", select: "firstName lastName role" }),
    Notification.countDocuments(query),
  ]);

  const payload = items.map((notification) => toClientPayload(notification, userId));

  const unread = payload.reduce((acc, item) => (!item.isRead ? acc + 1 : acc), 0);

  return {
    items: payload,
    unread,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit) || 1,
    },
  };
};

export const fetchPublicNotifications = async ({
  page = 1,
  limit = NOTIFICATION_DEFAULT_LIMIT,
}) => {
  const numericPage = Math.max(1, Number(page) || 1);
  const numericLimit = Math.max(1, Math.min(Number(limit) || NOTIFICATION_DEFAULT_LIMIT, 100));

  const query = {
    $and: [
      {
        $or: [
          { audience: NOTIFICATION_AUDIENCE.GLOBAL },
          { audience: NOTIFICATION_AUDIENCE.ROLE, recipientRole: "guest" },
        ],
      },
      withExpiryFilter(),
    ],
  };

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .populate({ path: "sender", select: "firstName lastName avatar role" }),
    Notification.countDocuments(query),
  ]);

  return {
    items: items.map((notification) => toClientPayload(notification, null)),
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit) || 1,
    },
  };
};

export const markNotificationAsRead = async ({ notificationId, userId }) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new ErrorResponse(404, MESSAGE.NOTIFICATION_NOT_FOUND);
  }

  if (notification.audience === NOTIFICATION_AUDIENCE.DIRECT) {
    if (notification.recipient?.toString() !== userId.toString()) {
      throw new ErrorResponse(403, MESSAGE.FORBIDDEN);
    }
    if (notification.status !== NOTIFICATION_STATUS.READ) {
      notification.status = NOTIFICATION_STATUS.READ;
      notification.readAt = new Date();
      await notification.save();
    }
  } else {
    const alreadySeen = (notification.seenBy || []).some(
      (id) => id?.toString() === userId.toString()
    );
    if (!alreadySeen) {
      notification.seenBy = [...(notification.seenBy || []), userId];
      await notification.save();
    }
  }

  await notification.populate({ path: "sender", select: "firstName lastName avatar role" });
  await notification.populate({ path: "recipient", select: "firstName lastName role" });

  return toClientPayload(notification, userId);
};

export const markAllNotificationsAsRead = async ({ userId, role }) => {
  if (!userId) return { updated: 0 };

  const directResult = await Notification.updateMany(
    {
      audience: NOTIFICATION_AUDIENCE.DIRECT,
      recipient: userId,
      status: NOTIFICATION_STATUS.UNREAD,
    },
    {
      status: NOTIFICATION_STATUS.READ,
      readAt: new Date(),
    }
  );

  const roleResult = await Notification.updateMany(
    {
      audience: { $in: [NOTIFICATION_AUDIENCE.GLOBAL, NOTIFICATION_AUDIENCE.ROLE] },
      ...(role
        ? {
            $or: [
              { audience: NOTIFICATION_AUDIENCE.GLOBAL },
              { audience: NOTIFICATION_AUDIENCE.ROLE, recipientRole: role },
            ],
          }
        : { audience: NOTIFICATION_AUDIENCE.GLOBAL }),
      seenBy: { $ne: userId },
    },
    {
      $addToSet: { seenBy: userId },
    }
  );

  return {
    updated: (directResult.modifiedCount || 0) + (roleResult.modifiedCount || 0),
  };
};
