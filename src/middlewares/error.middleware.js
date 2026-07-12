import { MESSAGE } from "../constants/message.js";
import { toResultError } from "../results/Result.js";
import dotenv from "dotenv";
dotenv.config();

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || MESSAGE.SYSTEM_ERROR;

  // Xử lý theo loại lỗi cụ thể
  switch (true) {
    case err.name === "CastError":
      statusCode = 404;
      message = MESSAGE.NOT_FOUND;
      break;

    case err.code === 11000:
      statusCode = 400;
      message = MESSAGE.DUPLICATE_DATA;
      break;

    case err.name === "ValidationError":
      statusCode = 400;
      message =
        Object.values(err.errors)
          .map((val) => val.message)
          .join(", ") || MESSAGE.VALIDATION_ERROR;
      break;

    case err.name === "JsonWebTokenError":
      statusCode = 401;
      message = MESSAGE.JWT_INVALID;
      break;

    case err.name === "TokenExpiredError":
      statusCode = 401;
      message = MESSAGE.JWT_EXPIRED;
      break;

    case err.name === "ForbiddenError":
      statusCode = 403;
      message = MESSAGE.FORBIDDEN;
      break;

    case err.name === "UnauthorizedError":
      statusCode = 401;
      message = MESSAGE.UNAUTHORIZED;
      break;

    default:
      // Nếu message rỗng hoặc undefined → fallback
      if (!message || message.trim() === "") {
        message = MESSAGE.SYSTEM_ERROR;
      }
      break;
  }
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", {
      name: err.name,
      code: err.statusCode,
      message,
      stack: err.stack,
    });
  }
  res.status(statusCode).json(
    toResultError({
      statusCode,
      msg: message,
    })
  );
};

const wrapAsync = (func) => {
  return async (req, res, next) => {
    try {
      await func(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export { errorHandler, wrapAsync };