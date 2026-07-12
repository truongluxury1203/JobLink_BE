import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import { toResultOk } from "../results/Result.js";
import Tag from "../models/Tag.js";
import Job from "../models/Job.js";

// Get all tags with pagination and search
export const getAllTags = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const total = await Tag.countDocuments(query);

    const tags = await Tag.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(parsedLimit);

    res.status(200).json({
      success: true,
      message: MESSAGE.TAG_FETCH_SUCCESS,
      data: tags,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error getting tags:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Create new tag
export const createTag = async (req, res) => {
  try {
    const { name } = req.body;

    // Check if tag already exists (case-insensitive)
    const existingTag = await Tag.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingTag) {
      throw new ErrorResponse(400, MESSAGE.TAG_ALREADY_EXISTS);
    }

    const newTag = new Tag({ name });
    await newTag.save();
    res.json(toResultOk({ msg: MESSAGE.TAG_CREATE_SUCCESS, data: newTag }));
  } catch (error) {
    if (error instanceof ErrorResponse) {
      throw error;
    }
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      throw new ErrorResponse(400, MESSAGE.TAG_ALREADY_EXISTS);
    }
    throw error;
  }
};

// Update tag by id
export const updateTag = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Check if tag exists
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new ErrorResponse(404, MESSAGE.TAG_NOT_FOUND);
  }

  // Check if another tag with the same name exists (case-insensitive)
  const existingTag = await Tag.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingTag) {
    throw new ErrorResponse(400, MESSAGE.TAG_ALREADY_EXISTS);
  }

  const updatedTag = await Tag.findByIdAndUpdate(id, { name }, { new: true });
  res.json(toResultOk({ msg: MESSAGE.TAG_UPDATE_SUCCESS, data: updatedTag }));
};

// Delete tag by id
export const deleteTag = async (req, res) => {
  const { id } = req.params;

  // Check if tag exists
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new ErrorResponse(404, MESSAGE.TAG_NOT_FOUND);
  }

  // Check if tag is being used in any job
  const jobsUsingTag = await Job.find({ tags: id });

  if (jobsUsingTag.length > 0) {
    throw new ErrorResponse(400, MESSAGE.TAG_IN_USE);
  }

  await Tag.findByIdAndDelete(id);
  res.json(toResultOk({ msg: MESSAGE.TAG_DELETE_SUCCESS }));
};
