import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";

export const aiCandidateMiddleware = (req, res, next) => {
  try {
    const { question } = req.body;
    question.trim();
    if (!question) {
      throw new ErrorResponse(400, MESSAGE.QUESTION_CANNOT_BE_EMPTY);
    }
    next();
  } catch (error) {
    next(error);
  }
};
