export const NOTIFICATION_AUDIENCE = Object.freeze({
  GLOBAL: "global",
  ROLE: "role",
  DIRECT: "direct",
});

export const NOTIFICATION_CATEGORY = Object.freeze({
  SYSTEM: "system",
  APPLICATION: "application",
  JOB: "job",
  ACCOUNT: "account",
  GENERAL: "general",
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

export const NOTIFICATION_STATUS = Object.freeze({
  UNREAD: "unread",
  READ: "read",
});

export const SUPPORTED_NOTIFICATION_ROLES = Object.freeze([
  "guest",
  "candidate",
  "recruiter",
  "admin",
]);

export const NOTIFICATION_DEFAULT_LIMIT = 20;
