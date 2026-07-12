import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import User from "../../models/User.js";
import {
  NOTIFICATION_AUDIENCE,
  SUPPORTED_NOTIFICATION_ROLES,
} from "../../constants/notification.js";
import { registerConnection, unregisterConnection } from "./connectionRegistry.js";

const resolveOriginWhitelist = () => {
  const origin = process.env.CLIENT_URL || "http://localhost:5173";
  return origin
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

let ioInstance;

const resolveRole = (user) => {
  if (!user) return "guest";
  const roleName = user.role?.name || user.role;
  if (SUPPORTED_NOTIFICATION_ROLES.includes(roleName)) {
    return roleName;
  }
  return "guest";
};

export const initSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: resolveOriginWhitelist(),
      credentials: true,
    },
  });

  ioInstance.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || null;
    let user = null;

    if (token) {
      try {
        const { payload } = await verifyAccessToken(token);
        if (payload?.userId) {
          user = await User.findById(payload.userId)
            .populate({ path: "role", select: "name" })
            .select("role firstName lastName");
        }
      } catch {
        // Nếu token không hợp lệ, coi như guest thay vì chặn kết nối
        user = null;
      }
    }

    const role = resolveRole(user);

    socket.data = {
      userId: user?._id?.toString() || null,
      role,
    };

    next();
  });

  ioInstance.on("connection", (socket) => {
    const { userId, role } = socket.data;

    socket.join("audience:global");
    socket.join(`role:${role}`);
    if (userId) {
      socket.join(`user:${userId}`);
    }

    registerConnection({
      socketId: socket.id,
      userId,
      role,
      token: socket.handshake.auth?.token ?? null,
    });

    socket.emit("notification:connection", {
      status: "connected",
      role,
    });

    socket.on("disconnect", () => {
      unregisterConnection(socket.id);
    });
  });

  return ioInstance;
};

export const getSocketServer = () => ioInstance;

export const emitNotificationEvent = (notification) => {
  if (!ioInstance || !notification) return;

  const audience = notification.audience ?? NOTIFICATION_AUDIENCE.GLOBAL;

  switch (audience) {
    case NOTIFICATION_AUDIENCE.DIRECT: {
      const target = notification.recipientId || notification.recipient;
      if (target) {
        ioInstance.to(`user:${target}`).emit("notification:created", notification);
      }
      break;
    }
    case NOTIFICATION_AUDIENCE.ROLE: {
      const targetRole = notification.recipientRole;
      if (targetRole) {
        ioInstance.to(`role:${targetRole}`).emit("notification:created", notification);
      }
      break;
    }
    case NOTIFICATION_AUDIENCE.GLOBAL:
    default: {
      ioInstance.to("audience:global").emit("notification:created", notification);
      break;
    }
  }
};
