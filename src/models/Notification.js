import mongoose from "mongoose";
import {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  SUPPORTED_NOTIFICATION_ROLES,
} from "../constants/notification.js";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1024,
    },
    category: {
      type: String,
      enum: Object.values(NOTIFICATION_CATEGORY),
      default: NOTIFICATION_CATEGORY.SYSTEM,
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.INFO,
    },
    audience: {
      type: String,
      enum: Object.values(NOTIFICATION_AUDIENCE),
      default: NOTIFICATION_AUDIENCE.GLOBAL,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    recipientRole: {
      type: String,
      enum: SUPPORTED_NOTIFICATION_ROLES,
      required() {
        return this.audience === NOTIFICATION_AUDIENCE.ROLE;
      },
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => ({}),
    },
    action: {
      label: { type: String, default: null },
      url: { type: String, default: null },
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.UNREAD,
    },
    readAt: {
      type: Date,
      default: null,
    },
    seenBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.pre("validate", function notificationValidate(next) {
  if (this.audience === NOTIFICATION_AUDIENCE.DIRECT && !this.recipient) {
    return next(new Error("Recipient is required for direct notifications"));
  }
  if (this.audience === NOTIFICATION_AUDIENCE.ROLE && !this.recipientRole) {
    return next(new Error("Recipient role is required for role notifications"));
  }
  return next();
});

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipientRole: 1, createdAt: -1 });
NotificationSchema.index({ audience: 1, createdAt: -1 });
NotificationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  }
);

export default mongoose.model("Notification", NotificationSchema);
