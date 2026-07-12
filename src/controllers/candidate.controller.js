import mongoose from "mongoose";
import Profile from "../models/Profile.js";
import { MESSAGE } from "../constants/message.js";
import { toResultError, toResultOk } from "../results/Result.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import Category from "../models/Category.js";
import JobFavorite from "../models/JobFavorite.js";
import Tag from "../models/Tag.js";
import { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY } from "../constants/notification.js";
import { notifyUser } from "../services/notification.service.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";

const SUPPORTED_SOCIAL_PLATFORMS = ["linkedin", "twitter", "facebook", "instagram"];
//
const normalizeToObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      return new mongoose.Types.ObjectId(trimmed);
    }

    const match = trimmed.match(/^ObjectId\(['"]?([0-9a-fA-F]{24})['"]?\)$/);
    if (match) {
      return new mongoose.Types.ObjectId(match[1]);
    }
  }

  return null;
};
// lọc và thu thập các ObjectId hợp lệ
const collectValidObjectIds = (values = []) => {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const objectId = normalizeToObjectId(value);
    if (objectId) {
      const key = objectId.toString();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(objectId);
      }
    }
  }

  return result;
};
const buildDocsMap = (docs = []) => {
  const map = new Map();
  for (const doc of docs) {
    if (doc?._id) {
      map.set(doc._id.toString(), doc);
    }
  }
  return map;
};
// parse sang Int
const parsePositiveInt = (value, defaultValue = 6, maxValue = 20) => {
  let numericValue = Number.NaN;

  if (typeof value === "string" && value.trim()) {
    numericValue = Number(value);
  } else if (Array.isArray(value) && value.length) {
    numericValue = Number(value[0]);
  } else if (typeof value === "number") {
    numericValue = value;
  }

  if (!Number.isFinite(numericValue)) return defaultValue;

  const parsed = Math.floor(numericValue);
  if (parsed <= 0) return defaultValue;

  if (typeof maxValue === "number" && Number.isFinite(maxValue)) {
    return Math.min(parsed, maxValue);
  }

  return parsed;
};

const formatTopAppliedJob = (job = {}, stat = {}) => {
  const jobId = normalizeToObjectId(job._id);
  if (!jobId) return null;

  const companyId = normalizeToObjectId(job?.company?._id || job?.company);
  const categoryId = normalizeToObjectId(job?.category?._id || job?.category);

  const tags = Array.isArray(job?.tags)
    ? job.tags
        .map((tag) => {
          if (!tag) return null;

          const tagId = normalizeToObjectId(tag?._id || tag);
          if (!tagId) return null;

          const name = typeof tag === "object" ? tag?.name || "" : "";
          return {
            tagId: tagId.toString(),
            name,
          };
        })
        .filter(Boolean)
    : [];

  const location = job?.location
    ? job.location
    : [job?.city, job?.country]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(", ");

  return {
    jobId: jobId.toString(),
    title: job?.title || "",
    jobType: job?.jobType || "",
    minSalary: job?.minSalary ?? null,
    maxSalary: job?.maxSalary ?? null,
    salaryType: job?.salaryType || null,
    totalApplicants: stat?.totalApplicants || 0,
    totalCandidates: stat?.totalCandidates || 0,
    lastAppliedAt: stat?.lastAppliedAt || null,
    vacancies: job?.vacancies ?? null,
    location: location || "",
    city: job?.city || "",
    country: job?.country || "",
    remote: Boolean(job?.remote),
    company: companyId
      ? {
          companyId: companyId.toString(),
          name: job?.company?.name || "",
          logo: job?.company?.logo || "",
        }
      : null,
    category: categoryId
      ? {
          categoryId: categoryId.toString(),
          name: job?.category?.name || "",
        }
      : null,
    tags,
    createdAt: job?.createdAt || null,
    updatedAt: job?.updatedAt || null,
  };
};
// Lọc data ứng tuyển
const hydrateApplications = async (applications = []) => {
  if (!applications.length) return [];

  const jobIds = collectValidObjectIds(applications.map((item) => item.job));
  if (!jobIds.length) return [];

  const jobs = await Job.find({ _id: { $in: jobIds } }).lean();

  const companyIds = collectValidObjectIds(jobs.map((job) => job.company));
  const categoryIds = collectValidObjectIds(jobs.map((job) => job.category));
  const tagIds = collectValidObjectIds(
    jobs.flatMap((job) => (Array.isArray(job.tags) ? job.tags : []))
  );

  const [companies, categories, tags] = await Promise.all([
    companyIds.length
      ? Company.find({ _id: { $in: companyIds } })
          .select("name logo")
          .lean()
      : Promise.resolve([]),
    categoryIds.length
      ? Category.find({ _id: { $in: categoryIds } })
          .select("name")
          .lean()
      : Promise.resolve([]),
    tagIds.length
      ? Tag.find({ _id: { $in: tagIds } })
          .select("name")
          .lean()
      : Promise.resolve([]),
  ]);

  const jobMap = buildDocsMap(jobs);
  const companyMap = buildDocsMap(companies);
  const categoryMap = buildDocsMap(categories);
  const tagMap = buildDocsMap(tags);

  return applications
    .map((application) => {
      const jobId = normalizeToObjectId(application.job);
      if (!jobId) return null;

      const rawJob = jobMap.get(jobId.toString());
      if (!rawJob) return null;

      const companyId = normalizeToObjectId(rawJob.company);
      const categoryId = normalizeToObjectId(rawJob.category);
      const jobTagIds = Array.isArray(rawJob.tags)
        ? rawJob.tags.map((tagId) => normalizeToObjectId(tagId)).filter((tagId) => tagId)
        : [];

      const hydratedJob = {
        ...rawJob,
        company: companyId ? companyMap.get(companyId.toString()) || null : null,
        category: categoryId ? categoryMap.get(categoryId.toString()) || null : null,
        tags: jobTagIds
          .map((tagId) => tagMap.get(tagId.toString()))
          .filter((tagDoc) => Boolean(tagDoc)),
      };

      return {
        applicationId: application._id,
        status: application.status || null,
        resume: application.resume || "",
        coverLetter: application.coverLetter || "",
        appliedAt: application.createdAt,
        job: hydratedJob,
      };
    })
    .filter((item) => Boolean(item?.job));
};
//lọc data và trả về object chỉ chứa các trường hợp lệ
const sanitizeSocialPayload = (social) => {
  if (!social || typeof social !== "object") return null;

  const sanitized = {};
  for (const field of SUPPORTED_SOCIAL_PLATFORMS) {
    const value = social[field];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) sanitized[field] = trimmed;
    }
  }

  return Object.keys(sanitized).length ? sanitized : null;
};
// Lấy dữ liệu profile từ payload
const extractProfilePayload = (payload = {}) => {
  const baseFields = ["experience", "education", "bio", "cv", "location"];
  const result = {};

  for (const field of baseFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined) {
      result[field] = payload[field];
    }
  }

  if (Array.isArray(payload.tags)) {
    result.tags = payload.tags;
  }

  const sanitizedSocial = sanitizeSocialPayload(payload.social);
  if (sanitizedSocial) {
    result.social = sanitizedSocial;
  }

  return result;
};

export const getCandidateProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const profile = await Profile.findOne({ user: user._id }).populate("tags", "name").lean();

    if (!profile)
      return res.json(toResultError({ statusCode: 404, msg: MESSAGE.PROFILE_NOT_FOUND }));

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_PROFILE_FETCH_SUCCESS,
        data: profile,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_PROFILE_FETCH_FAILED })
    );
  }
};

export const createCandidateProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const existingProfile = await Profile.findOne({ user: user._id });
    if (existingProfile)
      return res.json(
        toResultError({
          statusCode: 409,
          msg: MESSAGE.CANDIDATE_PROFILE_ALREADY_EXISTS,
        })
      );

    const payload = extractProfilePayload(req.body);

    const profile = await Profile.create({
      ...payload,
      user: user._id,
    });

    const populatedProfile = await profile.populate("tags", "name");

    return res.status(201).json(
      toResultOk({
        statusCode: 201,
        msg: MESSAGE.CANDIDATE_PROFILE_CREATE_SUCCESS,
        data: populatedProfile,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_PROFILE_CREATE_FAILED })
    );
  }
};

export const updateCandidateProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const profile = await Profile.findOne({ user: user._id });
    if (!profile)
      return res.json(toResultError({ statusCode: 404, msg: MESSAGE.PROFILE_NOT_FOUND }));

    const payload = extractProfilePayload(req.body);

    if (Object.keys(payload).length === 0)
      return res.json(toResultError({ statusCode: 400, msg: MESSAGE.FIELD_REQUIRED }));

    const { social, ...rest } = payload;

    for (const [key, value] of Object.entries(rest)) {
      profile[key] = value;
    }

    if (social) {
      const updatedSocial = { ...(profile.social || {}) };
      for (const [platform, url] of Object.entries(social)) {
        updatedSocial[platform] = url;
      }
      profile.social = updatedSocial;
    }

    await profile.save();
    await profile.populate("tags", "name");

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_PROFILE_UPDATE_SUCCESS,
        data: profile,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_PROFILE_UPDATE_FAILED })
    );
  }
};

export const getCandidateSocial = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const profile = await Profile.findOne({ user: user._id }).select("social");
    if (!profile)
      return res.json(toResultError({ statusCode: 404, msg: MESSAGE.PROFILE_NOT_FOUND }));

    // Convert object => array để FE dễ hiển thị
    const socialArray = Object.entries(profile.social || {}).map(([platform, url]) => ({
      platform,
      url: url || "",
    }));

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_SOCIAL_FETCH_SUCCESS,
        data: socialArray,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_SOCIAL_FETCH_FAILED }));
  }
};

export const addCandidateSocial = async (req, res) => {
  try {
    const { social } = req.body;
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    if (!Array.isArray(social))
      return res.json(
        toResultError({ statusCode: 400, msg: MESSAGE.CANDIDATE_SOCIAL_ALREADY_EXISTS })
      );

    let profile = await Profile.findOne({ user: user._id });

    // Map array → object
    const newSocial = {};
    for (const { platform, url } of social) {
      if (SUPPORTED_SOCIAL_PLATFORMS.includes(platform) && url) {
        newSocial[platform] = url;
      }
    }

    if (!profile) {
      profile = await Profile.create({
        user: user._id,
        social: newSocial,
      });
    } else {
      profile.social = newSocial;
      await profile.save();
    }

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_SOCIAL_CREATE_SUCCESS,
        data: profile.social,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_SOCIAL_CREATE_FAILED })
    );
  }
};

export const updateCandidateSocial = async (req, res) => {
  try {
    const { platform, url } = req.body;

    if (!platform || !url)
      return res.json(toResultError({ statusCode: 400, msg: MESSAGE.FIELD_REQUIRED }));

    if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform))
      return res.json(
        toResultError({ statusCode: 400, msg: MESSAGE.CANDIDATE_PROFILE_UPDATE_FAILED })
      );

    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    let profile = await Profile.findOne({ user: user._id });

    if (!profile) {
      profile = await Profile.create({
        user: user._id,
        social: { [platform]: url },
      });
    } else {
      profile.social = { ...(profile.social || {}), [platform]: url };
      await profile.save();
    }

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_SOCIAL_UPDATE_SUCCESS,
        data: profile.social,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_SOCIAL_UPDATE_FAILED })
    );
  }
};

export const deleteCandidateSocial = async (req, res) => {
  try {
    const { platform } = req.body;
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    if (!platform) return res.json(toResultError({ statusCode: 400, msg: MESSAGE.FIELD_REQUIRED }));

    const profile = await Profile.findOne({ user: user._id });
    if (!profile)
      return res.json(toResultError({ statusCode: 404, msg: MESSAGE.PROFILE_NOT_FOUND }));

    if (profile.social[platform]) {
      delete profile.social[platform];
      await profile.save();
    }

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_SOCIAL_DELETE_SUCCESS,
        data: profile.social,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_SOCIAL_DELETE_FAILED })
    );
  }
};

export const getCandidateAppliedJobs = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const applications = await Application.find({ candidate: user._id })
      .sort({ createdAt: -1 })
      .lean();

    const appliedJobs = await hydrateApplications(applications);

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_APPLIED_JOBS_FETCH_SUCCESS,
        data: appliedJobs,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({
        statusCode: 500,
        msg: MESSAGE.CANDIDATE_APPLIED_JOBS_FETCH_FAILED,
      })
    );
  }
};

export const getCandidateFavoriteJobs = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const favorites = await JobFavorite.find({ candidate: user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!favorites.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_FAVORITE_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const jobIds = collectValidObjectIds(favorites.map((favorite) => favorite.job));

    if (!jobIds.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_FAVORITE_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const rawJobs = await Job.find({ _id: { $in: jobIds } })
      .populate({ path: "company", select: "name logo" })
      .populate({ path: "category", select: "name" })
      .populate({ path: "tags", select: "name" })
      .lean();

    if (!rawJobs.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_FAVORITE_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const jobMap = buildDocsMap(rawJobs);

    const favoriteJobs = favorites
      .map((favorite) => {
        const jobId = normalizeToObjectId(favorite.job);
        if (!jobId) return null;

        const job = jobMap.get(jobId.toString());
        if (!job) return null;

        const jobWithFavorite = { ...job, isFavorite: true };

        return {
          favoriteId: favorite._id?.toString?.() || "",
          favoritedAt: favorite.createdAt || null,
          jobId: job._id?.toString?.() || "",
          job: jobWithFavorite,
        };
      })
      .filter(Boolean);

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_FAVORITE_JOBS_FETCH_SUCCESS,
        data: favoriteJobs,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({
        statusCode: 500,
        msg: MESSAGE.CANDIDATE_FAVORITE_JOBS_FETCH_FAILED,
      })
    );
  }
};

export const getTopAppliedJobs = async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query?.limit, 6, 20);
    const aggregationLimit = Math.max(limit * 3, limit);

    const topJobStats = await Application.aggregate([
      {
        $match: {
          job: { $ne: null },
          candidate: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$job",
          totalApplicants: { $sum: 1 },
          lastAppliedAt: { $max: "$createdAt" },
          uniqueCandidates: { $addToSet: "$candidate" },
        },
      },
      {
        $project: {
          totalApplicants: 1,
          lastAppliedAt: 1,
          totalCandidates: {
            $size: {
              $setDifference: ["$uniqueCandidates", [null]],
            },
          },
        },
      },
      {
        $sort: {
          totalApplicants: -1,
          totalCandidates: -1,
          lastAppliedAt: -1,
          _id: 1,
        },
      },
      {
        $limit: aggregationLimit,
      },
    ]);

    if (!topJobStats.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_TOP_APPLIED_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const jobIds = collectValidObjectIds(topJobStats.map((item) => item._id));

    if (!jobIds.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_TOP_APPLIED_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const rawJobs = await Job.find({ _id: { $in: jobIds }, isActive: true }).lean();

    if (!rawJobs.length) {
      return res.json(
        toResultOk({
          msg: MESSAGE.CANDIDATE_TOP_APPLIED_JOBS_FETCH_SUCCESS,
          data: [],
        })
      );
    }

    const companyIds = collectValidObjectIds(rawJobs.map((job) => job.company));
    const categoryIds = collectValidObjectIds(rawJobs.map((job) => job.category));
    const tagIds = collectValidObjectIds(
      rawJobs.flatMap((job) => (Array.isArray(job?.tags) ? job.tags : []))
    );

    const [companies, categories, tags] = await Promise.all([
      companyIds.length
        ? Company.find({ _id: { $in: companyIds } })
            .select("name logo")
            .lean()
        : Promise.resolve([]),
      categoryIds.length
        ? Category.find({ _id: { $in: categoryIds } })
            .select("name")
            .lean()
        : Promise.resolve([]),
      tagIds.length
        ? Tag.find({ _id: { $in: tagIds } })
            .select("name")
            .lean()
        : Promise.resolve([]),
    ]);

    const companyMap = buildDocsMap(companies);
    const categoryMap = buildDocsMap(categories);
    const tagMap = buildDocsMap(tags);

    const hydratedJobs = rawJobs.map((job) => {
      const jobCompanyId = normalizeToObjectId(job.company);
      const jobCategoryId = normalizeToObjectId(job.category);

      const hydratedTags = Array.isArray(job.tags)
        ? job.tags
            .map((tag) => {
              const tagId = normalizeToObjectId(tag);
              if (!tagId) return null;
              const tagDoc = tagMap.get(tagId.toString());
              if (!tagDoc) return null;
              return tagDoc;
            })
            .filter(Boolean)
        : [];

      return {
        ...job,
        company: jobCompanyId ? companyMap.get(jobCompanyId.toString()) || null : null,
        category: jobCategoryId ? categoryMap.get(jobCategoryId.toString()) || null : null,
        tags: hydratedTags,
      };
    });

    const jobMap = buildDocsMap(hydratedJobs);

    const topJobs = [];
    for (const stat of topJobStats) {
      if (topJobs.length >= limit) break;

      const jobId = normalizeToObjectId(stat?._id);
      if (!jobId) continue;

      const job = jobMap.get(jobId.toString());
      if (!job) continue;

      const formatted = formatTopAppliedJob(job, stat);
      if (!formatted) continue;

      topJobs.push(formatted);
    }

    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_TOP_APPLIED_JOBS_FETCH_SUCCESS,
        data: topJobs,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({
        statusCode: 500,
        msg: MESSAGE.CANDIDATE_TOP_APPLIED_JOBS_FETCH_FAILED,
      })
    );
  }
};

export const applyJob = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }
    const roleName = user?.role?.name || user?.role;
    if (!roleName || String(roleName).toLowerCase() !== "candidate") {
      return res.json(
        toResultError({
          statusCode: 403,
          msg: MESSAGE.CANDIDATE_APPLY_JOB_ROLE_INVALID,
        })
      );
    }

    const { jobId, resume, coverLetter } = req.body;
    if (!jobId) {
      return res.json(toResultError({ statusCode: 400, msg: MESSAGE.FIELD_REQUIRED }));
    }

    const job = await Job.findById(jobId).lean();
    if (!job) {
      return res.json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));
    }

    const profile = await Profile.findOne({ user: user._id }).select("cv").lean();
    const hasProfileCv = Boolean(profile?.cv && String(profile.cv).trim());
    const hasResumeInPayload = typeof resume === "string" && resume.trim().length > 0;

    if (!hasProfileCv && !hasResumeInPayload) {
      return res.json(
        toResultError({
          statusCode: 400,
          msg: MESSAGE.CANDIDATE_APPLY_JOB_CV_REQUIRED,
        })
      );
    }

    const existingApplication = await Application.findOne({
      candidate: user._id,
      job: jobId,
    });

    if (existingApplication) {
      return res.json(
        toResultError({ statusCode: 409, msg: MESSAGE.CANDIDATE_ALREADY_APPLIED_JOB })
      );
    }

    const application = await Application.create({
      candidate: user._id,
      job: jobId,
      resume: hasResumeInPayload ? resume.trim() : profile?.cv || "",
      coverLetter: coverLetter || "",
      status: "Pending",
    });

    let recruiterId = job?.recruiter;
    if (!recruiterId && job?.company) {
      const company = await Company.findById(job.company).select("recruiter").lean();
      recruiterId = company?.recruiter || null;
    }

    const candidateName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    const jobTitle = job?.title || "Công việc";

    const notificationTasks = [];
    if (recruiterId) {
      notificationTasks.push(
        notifyUser({
          userId: recruiterId,
          senderId: user._id,
          title: "Ứng viên mới",
          message: `${candidateName || "Ứng viên"} đã ứng tuyển vị trí ${jobTitle}.`,
          category: NOTIFICATION_CATEGORY.APPLICATION,
          priority: NOTIFICATION_PRIORITY.INFO,
          metadata: {
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
          },
          action: {
            label: "Xem ứng viên",
            url: "/recruiter/applications" + `?jobId=${job._id.toString()}`,
          },
        })
      );
    }

    if (notificationTasks.length) {
      await Promise.allSettled(notificationTasks);
    }

    const appliedJobs = await hydrateApplications([application.toObject()]);
    const appliedJob = appliedJobs[0] || {
      applicationId: application._id,
      status: application.status,
      resume: application.resume,
      coverLetter: application.coverLetter,
      appliedAt: application.createdAt,
      job,
    };

    return res.status(201).json(
      toResultOk({
        statusCode: 201,
        msg: MESSAGE.CANDIDATE_APPLY_JOB_SUCCESS,
        data: appliedJob,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({
        statusCode: 500,
        msg: MESSAGE.CANDIDATE_APPLY_JOB_FAILED,
      })
    );
  }
};

export const getInfoCandidate = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }
    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_PROFILE_FETCH_SUCCESS,
        data: user,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_PROFILE_FETCH_FAILED })
    );
  }
};

export const updateInfoCandidate = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const user = req.user;
    if (!user) {
      return res.json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }
    if (typeof firstName === "string" && firstName.trim()) user.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim()) user.lastName = lastName.trim();

    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== "string") {
        return res.json(toResultError({ statusCode: 400, msg: MESSAGE.PHONENUMBER_INVALID }));
      }

      const sanitizedPhone = phoneNumber.trim();
      if (!sanitizedPhone) {
        return res.json(toResultError({ statusCode: 400, msg: MESSAGE.PHONENUMBER_INVALID }));
      }

      const phoneRegex = /^[0-9+()\-\s]{6,20}$/;
      if (!phoneRegex.test(sanitizedPhone)) {
        return res.json(toResultError({ statusCode: 400, msg: MESSAGE.PHONENUMBER_INVALID }));
      }

      user.phoneNumber = sanitizedPhone;
    }
    await user.save();
    return res.json(
      toResultOk({
        msg: MESSAGE.CANDIDATE_PROFILE_UPDATE_SUCCESS,
        data: user,
      })
    );
  } catch (error) {
    console.error(error);
    return res.json(
      toResultError({ statusCode: 500, msg: MESSAGE.CANDIDATE_PROFILE_UPDATE_FAILED })
    );
  }
};

export const getJobById = async (req, res) => {
  const { id } = req.params;

  const userId = req.user?._id || null;

  const job = await Job.findById(id)
    .populate({ path: "recruiter", select: "username firstName lastName -_id" })
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "tags", select: "name" });
  if (!job) {
    throw new ErrorResponse(404, MESSAGE.JOB_NOT_FOUND);
  }
  // Determine favorite flag for this job
  let isFavorite = false;
  if (userId) {
    const fav = await JobFavorite.exists({ candidate: userId, job: id });
    isFavorite = !!fav;
  }

  const jobObj = job.toObject();
  jobObj.isFavorite = isFavorite;

  res.json(toResultOk({ msg: MESSAGE.JOB_FETCH_SUCCESS, data: jobObj }));
};
