export const TOKEN_EXPIRATION = {
  ACCESS_EXPIRES: "15m",
  REFRESH_EXPIRES: "30d",
  EMAIL_EXPIRES: "1d",
  RESET_EXPIRES: "5m",
};

export const STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const REGEX = {
  PHONE: /^(0|\+84)[3|5|7|8|9]\d{8}$/,
};

export const FRONTEND_ROUTES = {
  JOB_DETAILS: "/jobs", // Path to job details page on frontend
};
