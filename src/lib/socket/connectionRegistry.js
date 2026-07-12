const socketRegistry = new Map();
const userSockets = new Map();
const roleSockets = new Map();

const ensureSet = (store, key) => {
  if (!store.has(key)) {
    store.set(key, new Set());
  }
  return store.get(key);
};

export const registerConnection = ({ socketId, userId = null, role = "guest", token = null }) => {
  const meta = {
    socketId,
    userId,
    role,
    token,
    connectedAt: new Date().toISOString(),
  };

  socketRegistry.set(socketId, meta);

  if (userId) {
    ensureSet(userSockets, userId).add(socketId);
  }
  ensureSet(roleSockets, role).add(socketId);

  return meta;
};

export const unregisterConnection = (socketId) => {
  const meta = socketRegistry.get(socketId);
  if (!meta) return null;

  socketRegistry.delete(socketId);

  if (meta.userId && userSockets.has(meta.userId)) {
    const sockets = userSockets.get(meta.userId);
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(meta.userId);
    }
  }

  if (roleSockets.has(meta.role)) {
    const sockets = roleSockets.get(meta.role);
    sockets.delete(socketId);
    if (sockets.size === 0) {
      roleSockets.delete(meta.role);
    }
  }

  return meta;
};

export const getUserConnections = (userId) => {
  return Array.from(userSockets.get(userId) ?? []);
};

export const getRoleConnections = (role) => {
  return Array.from(roleSockets.get(role) ?? []);
};

export const getConnectionMeta = (socketId) => socketRegistry.get(socketId) ?? null;

export const getSnapshot = () => ({
  total: socketRegistry.size,
  users: Array.from(userSockets.entries()).map(([userId, sockets]) => ({
    userId,
    sockets: Array.from(sockets),
  })),
  roles: Array.from(roleSockets.entries()).map(([role, sockets]) => ({
    role,
    sockets: Array.from(sockets),
  })),
});
