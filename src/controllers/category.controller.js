import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import { toResultOk } from "../results/Result.js";
import Category from "../models/Category.js";
import Job from "../models/Job.js";

// Get all categories with pagination and search
export const getAllCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const total = await Category.countDocuments(query);

    const categories = await Category.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(parsedLimit);

    res.status(200).json({
      success: true,
      message: MESSAGE.CATEGORY_FETCH_SUCCESS,
      data: categories,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Create new category
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category already exists (case-insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      throw new ErrorResponse(400, MESSAGE.CATEGORY_ALREADY_EXISTS);
    }

    const newCategory = new Category({ name, description });
    await newCategory.save();
    res.json(toResultOk({ msg: MESSAGE.CATEGORY_CREATE_SUCCESS, data: newCategory }));
  } catch (error) {
    if (error instanceof ErrorResponse) {
      throw error;
    }
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      throw new ErrorResponse(400, MESSAGE.CATEGORY_ALREADY_EXISTS);
    }
    throw error;
  }
};

// Update category by id
export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  // Check if category exists
  const category = await Category.findById(id);
  if (!category) {
    throw new ErrorResponse(404, MESSAGE.CATEGORY_NOT_FOUND);
  }

  // Check if another category with the same name exists (case-insensitive)
  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingCategory) {
    throw new ErrorResponse(400, MESSAGE.CATEGORY_ALREADY_EXISTS);
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    { name, description },
    { new: true }
  );
  res.json(toResultOk({ msg: MESSAGE.CATEGORY_UPDATE_SUCCESS, data: updatedCategory }));
};

// Delete category by id
export const deleteCategory = async (req, res) => {
  const { id } = req.params;

  // Check if category exists
  const category = await Category.findById(id);
  if (!category) {
    throw new ErrorResponse(404, MESSAGE.CATEGORY_NOT_FOUND);
  }

  // Check if category is being used in any job
  const jobsUsingCategory = await Job.find({ category: id });

  if (jobsUsingCategory.length > 0) {
    throw new ErrorResponse(400, MESSAGE.CATEGORY_IN_USE);
  }

  await Category.findByIdAndDelete(id);
  res.json(toResultOk({ msg: MESSAGE.CATEGORY_DELETE_SUCCESS }));
};

// Get popular categories with openings count
export const getPopularCategories = async (req, res) => {
  const { limit = 8, onlyActive = "true" } = req.query;

  const matchStage = {};
  if (onlyActive === "true") {
    matchStage.isActive = true;
  }

  const results = await Job.aggregate([
    { $match: matchStage },
    { $match: { category: { $ne: null } } },
    { $group: { _id: "$category", openings: { $sum: 1 } } },
    { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
    { $unwind: "$category" },
    { $project: { _id: "$category._id", label: "$category.name", openings: 1 } },
    { $sort: { openings: -1 } },
    { $limit: parseInt(limit) },
  ]);

  res.json(toResultOk({ msg: MESSAGE.CATEGORY_FETCH_SUCCESS, data: results }));
};
