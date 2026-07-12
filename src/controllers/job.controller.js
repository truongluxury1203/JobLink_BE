import { MESSAGE } from "../constants/message.js";
import ErrorResponse from "../lib/helper/ErrorResponse.js";
import Tag from "../models/Tag.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import JobFavorite from "../models/JobFavorite.js";
import Category from "../models/Category.js";
import Company from "../models/Company.js";
import { toResultOk } from "../results/Result.js";
import { getEmbedding } from "../lib/vectorstores/embedding.js";
import { upsertItems } from "../lib/vectorstores/pineconeStore.js";
import Profile from '../models/Profile.js';


export const getAllJobs = async (req, res) => {
  const {
    search,
    categoryId,
    company,
    jobType,
    experience,
    isActive = true,
    page = 1,
    limit = 15,
    minSalary,
    maxSalary,
    remote,
  } = req.query;

  let query = {};

  if (search) {
    const tags = await Tag.find({ name: { $regex: search, $options: "i" } }).select("_id");
    const tagIds = tags.map((tag) => tag._id);
    const categories = await Category.find({ name: { $regex: search, $options: "i" } }).select(
      "_id"
    );
    const categoryIdsFromSearch = categories.map((c) => c._id);

    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { tags: { $in: tagIds } },
      { category: { $in: categoryIdsFromSearch } },
      { country: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { jobLevel: { $regex: search, $options: "i" } },
      { experience: { $regex: search, $options: "i" } },
      { education: { $regex: search, $options: "i" } },
    ];
  }
  if (categoryId) query.category = categoryId;
  // Filter by company name
  if (company) {
    const companiesFromFilter = await Company.find({ name: { $regex: company, $options: "i" } }).select("_id");
    const companyIdsFromFilter = companiesFromFilter.map((c) => c._id);
    if (companyIdsFromFilter.length > 0) {
      query.company = { $in: companyIdsFromFilter };
    }
  }
  if (jobType) query.jobType = jobType;
  if (experience) query.experience = experience;
  if (remote !== undefined) query.remote = remote === "true";
  // Apply isActive as an AND filter
  if (typeof isActive !== "undefined") {
    query.isActive = typeof isActive === "string" ? isActive === "true" : !!isActive;
  }

  if (minSalary || maxSalary) {
    query.$and = query.$and || [];
    if (minSalary) {
      query.$and.push({ minSalary: { $gte: Number(minSalary) } });
    }
    if (maxSalary) {
      query.$and.push({ maxSalary: { $lte: Number(maxSalary) } });
    }
    if (query.$and.length === 1) {
      query = { ...query, ...query.$and[0] };
      delete query.$and;
    }
    if (query.$and && query.$and.length === 0) delete query.$and;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const jobs = await Job.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "recruiter", select: "firstName lastName -_id" })
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "tags", select: "name -_id" })
    .lean();

  const total = await Job.countDocuments(query);

  res.json(
    toResultOk({
      msg: MESSAGE.JOB_FETCH_SUCCESS,
      data: {
        jobs: jobs,
        totalPages: Math.ceil(total / limit),
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};
export const getAllJobsWithAuth = async (req, res) => {
  const {
    search,
    categoryId,
    company,
    jobType,
    experience,
    isActive = true,
    page = 1,
    limit = 15,
    minSalary,
    maxSalary,
    remote,
  } = req.query;
  const userId = req.user?._id || null;

  let query = {};

  if (search) {
    const tags = await Tag.find({ name: { $regex: search, $options: "i" } }).select("_id");
    const tagIds = tags.map((tag) => tag._id);
    const categories = await Category.find({ name: { $regex: search, $options: "i" } }).select(
      "_id"
    );
    const categoryIdsFromSearch = categories.map((c) => c._id);

    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { tags: { $in: tagIds } },
      { category: { $in: categoryIdsFromSearch } },
      { country: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { jobLevel: { $regex: search, $options: "i" } },
      { experience: { $regex: search, $options: "i" } },
      { education: { $regex: search, $options: "i" } },
    ];
  }
  if (categoryId) query.category = categoryId;
  // Filter by company name
  if (company) {
    const companiesFromFilter = await Company.find({ name: { $regex: company, $options: "i" } }).select("_id");
    const companyIdsFromFilter = companiesFromFilter.map((c) => c._id);
    if (companyIdsFromFilter.length > 0) {
      query.company = { $in: companyIdsFromFilter };
    }
  }
  if (jobType) query.jobType = jobType;
  if (experience) query.experience = experience;
  if (remote !== undefined) query.remote = remote === "true";
  // Exclude jobs where recruiter is the current user
  if (userId) {
    query.recruiter = { $ne: userId };
  }
  // Apply isActive as an AND filter
  if (typeof isActive !== "undefined") {
    query.isActive = typeof isActive === "string" ? isActive === "true" : !!isActive;
  }

  if (minSalary || maxSalary) {
    query.$and = query.$and || [];
    if (minSalary) {
      query.$and.push({ minSalary: { $gte: Number(minSalary) } });
    }
    if (maxSalary) {
      query.$and.push({ maxSalary: { $lte: Number(maxSalary) } });
    }
    if (query.$and.length === 1) {
      query = { ...query, ...query.$and[0] };
      delete query.$and;
    }
    if (query.$and && query.$and.length === 0) delete query.$and;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const jobs = await Job.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "recruiter", select: "firstName lastName -_id" })
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "tags", select: "name -_id" })
    .lean();

  // Add isFavorite flag for each job based on JobFavorite by userId
  let favoriteSet = new Set();
  if (userId && jobs.length) {
    const jobIds = jobs.map((j) => j._id);
    const favorites = await JobFavorite.find({ candidate: userId, job: { $in: jobIds } })
      .select("job")
      .lean();
    favoriteSet = new Set(favorites.map((f) => String(f.job)));
  }

  const jobsWithFavorite = jobs.map((j) => ({
    ...j,
    isFavorite: favoriteSet.has(String(j._id)),
  }));

  const total = await Job.countDocuments(query);

  res.json(
    toResultOk({
      msg: MESSAGE.JOB_FETCH_SUCCESS,
      data: {
        jobs: jobsWithFavorite,
        totalPages: Math.ceil(total / limit),
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};
// toggle favorite a job
export const toggleFavoriteAJob = async (req, res) => {
  const candidateId = req?.user._id;
  const { jobId } = req.params;
  const job = await Job.findById(jobId);
  if (!job) {
    throw new ErrorResponse(404, MESSAGE.JOB_NOT_FOUND);
  }
  const existingFavorite = await JobFavorite.findOne({ candidate: candidateId, job: jobId });
  if (existingFavorite) {
    // If already favorited, remove it
    await JobFavorite.deleteOne({ _id: existingFavorite._id });
    res.json(toResultOk({ msg: MESSAGE.JOB_FAVORITE_REMOVED }));
  } else {
    // If not favorited, create a new favorite
    const newFavorite = new JobFavorite({ candidate: candidateId, job: jobId });
    await newFavorite.save();
    res.json(toResultOk({ msg: MESSAGE.JOB_FAVORITE_ADDED }));
  }
};

// create new job
export const createJob = async (req, res) => {
  const recruiterId = req?.user._id;
  const newJob = new Job({ ...req.body, recruiter: recruiterId });
  const result = await newJob.save();
  if (!result) {
    throw new ErrorResponse(400, MESSAGE.JOB_CREATE_FAILED);
  }

  // Populate job data for embedding
  const populatedJob = await Job.findById(result._id)
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name" })
    .populate({ path: "tags", select: "name" })
    .populate({ path: "recruiter", select: "firstName lastName" });

  // Create text content for embedding
  const tagsText = populatedJob.tags?.map((tag) => tag.name).join(", ") || "";
  const categoryText = populatedJob.category?.name || "";
  const companyText = populatedJob.company?.name || "";
  const recruiterName = populatedJob.recruiter
    ? `${populatedJob.recruiter.firstName || ""} ${populatedJob.recruiter.lastName || ""}`.trim()
    : "";

  const jobText = `
Title: ${populatedJob.title}
Company: ${companyText}
Category: ${categoryText}
Tags: ${tagsText}
Role: ${populatedJob.role || ""}
Description: ${populatedJob.description || ""}
Requirements: ${populatedJob.requirements || ""}
Desirable: ${populatedJob.desirable || ""}
Benefits: ${populatedJob.benefits || ""}
Location: ${populatedJob.location || ""}
City: ${populatedJob.city || ""}
Country: ${populatedJob.country || ""}
Job Type: ${populatedJob.jobType || ""}
Experience: ${populatedJob.experience || ""}
Job Level: ${populatedJob.jobLevel || ""}
Education: ${populatedJob.education || ""}
Salary: ${populatedJob.minSalary || ""} - ${populatedJob.maxSalary || ""} ${populatedJob.salaryType || ""}
Remote: ${populatedJob.remote ? "Yes" : "No"}
  `.trim();

  try {
    // Generate embedding for the job
    const embedding = await getEmbedding(jobText);

    // Upsert to Pinecone with full metadata
    await upsertItems([
      {
        id: result._id.toString(),
        values: embedding,
        metadata: {
          text: jobText,
          title: populatedJob.title,
          company: companyText,
          companyId: populatedJob.company?._id?.toString() || "",
          category: categoryText,
          categoryId: populatedJob.category?._id?.toString() || "",
          tags: tagsText,
          role: populatedJob.role || "",
          description: populatedJob.description || "",
          requirements: populatedJob.requirements || "",
          desirable: populatedJob.desirable || "",
          benefits: populatedJob.benefits || "",
          location: populatedJob.location || "",
          city: populatedJob.city || "",
          country: populatedJob.country || "",
          jobType: populatedJob.jobType || "",
          experience: populatedJob.experience || "",
          jobLevel: populatedJob.jobLevel || "",
          education: populatedJob.education || "",
          minSalary: populatedJob.minSalary || 0,
          maxSalary: populatedJob.maxSalary || 0,
          salaryType: populatedJob.salaryType || "",
          remote: populatedJob.remote || false,
          vacancies: populatedJob.vacancies || 0,
          applyType: populatedJob.applyType || "",
          expiration: populatedJob.expiration ? populatedJob.expiration.toISOString() : "",
          recruiterName: recruiterName,
          recruiterId: populatedJob.recruiter?._id?.toString() || "",
          isActive: populatedJob.isActive,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        },
      },
    ]);
  } catch (embeddingError) {
    console.error("Error creating embedding for job:", embeddingError);
    // Don't throw error, job is still created successfully
  }

  res.json(toResultOk({ statusCode: 201, msg: MESSAGE.JOB_CREATE_SUCCESS, data: result }));
};

// get job by id
export const getJobById = async (req, res) => {
  const { id } = req.params;

  const job = await Job.findById(id)
    .populate({ path: "recruiter", select: "username firstName lastName -_id" })
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "tags", select: "name" });
  if (!job) {
    throw new ErrorResponse(404, MESSAGE.JOB_NOT_FOUND);
  }
  res.json(toResultOk({ msg: MESSAGE.JOB_FETCH_SUCCESS, data: job }));
};
// get job by id with auth
export const getJobByIdWithAuth = async (req, res) => {
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
// update job by id
export const updateJob = async (req, res) => {
  const recruiterId = req?.user._id;
  const { id } = req.params;
  const updatedJob = await Job.findByIdAndUpdate(
    id,
    { ...req.body, recruiter: recruiterId },
    { new: true }
  );
  if (!updatedJob) {
    throw new ErrorResponse(404, MESSAGE.JOB_NOT_FOUND);
  }

  // Populate job data for embedding
  const populatedJob = await Job.findById(updatedJob._id)
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name" })
    .populate({ path: "tags", select: "name" })
    .populate({ path: "recruiter", select: "firstName lastName" });

  // Create text content for embedding
  const tagsText = populatedJob.tags?.map((tag) => tag.name).join(", ") || "";
  const categoryText = populatedJob.category?.name || "";
  const companyText = populatedJob.company?.name || "";
  const recruiterName = populatedJob.recruiter
    ? `${populatedJob.recruiter.firstName || ""} ${populatedJob.recruiter.lastName || ""}`.trim()
    : "";

  const jobText = `
Title: ${populatedJob.title}
Company: ${companyText}
Category: ${categoryText}
Tags: ${tagsText}
Role: ${populatedJob.role || ""}
Description: ${populatedJob.description || ""}
Requirements: ${populatedJob.requirements || ""}
Desirable: ${populatedJob.desirable || ""}
Benefits: ${populatedJob.benefits || ""}
Location: ${populatedJob.location || ""}
City: ${populatedJob.city || ""}
Country: ${populatedJob.country || ""}
Job Type: ${populatedJob.jobType || ""}
Experience: ${populatedJob.experience || ""}
Job Level: ${populatedJob.jobLevel || ""}
Education: ${populatedJob.education || ""}
Salary: ${populatedJob.minSalary || ""} - ${populatedJob.maxSalary || ""} ${populatedJob.salaryType || ""}
Remote: ${populatedJob.remote ? "Yes" : "No"}
  `.trim();

  try {
    // Generate embedding for the updated job
    const embedding = await getEmbedding(jobText);

    // Upsert to Pinecone (will update if exists) with full metadata
    await upsertItems([
      {
        id: updatedJob._id.toString(),
        values: embedding,
        metadata: {
          text: jobText,
          title: populatedJob.title,
          company: companyText,
          companyId: populatedJob.company?._id?.toString() || "",
          category: categoryText,
          categoryId: populatedJob.category?._id?.toString() || "",
          tags: tagsText,
          role: populatedJob.role || "",
          description: populatedJob.description || "",
          requirements: populatedJob.requirements || "",
          desirable: populatedJob.desirable || "",
          benefits: populatedJob.benefits || "",
          location: populatedJob.location || "",
          city: populatedJob.city || "",
          country: populatedJob.country || "",
          jobType: populatedJob.jobType || "",
          experience: populatedJob.experience || "",
          jobLevel: populatedJob.jobLevel || "",
          education: populatedJob.education || "",
          minSalary: populatedJob.minSalary || 0,
          maxSalary: populatedJob.maxSalary || 0,
          salaryType: populatedJob.salaryType || "",
          remote: populatedJob.remote || false,
          vacancies: populatedJob.vacancies || 0,
          applyType: populatedJob.applyType || "",
          expiration: populatedJob.expiration ? populatedJob.expiration.toISOString() : "",
          recruiterName: recruiterName,
          recruiterId: populatedJob.recruiter?._id?.toString() || "",
          isActive: populatedJob.isActive,
          createdAt: populatedJob.createdAt.toISOString(),
          updatedAt: updatedJob.updatedAt.toISOString(),
        },
      },
    ]);
  } catch (embeddingError) {
    console.error("Error updating embedding for job:", embeddingError);
    // Don't throw error, job is still updated successfully
  }

  res.json(toResultOk({ msg: MESSAGE.JOB_UPDATE_SUCCESS, data: updatedJob }));
};

// get jobs by recruiter id
export const getJobsByRecruiterId = async (req, res) => {
  const recruiterId = req.user._id;
  const {
    search,
    categoryId,
    jobType,
    experience,
    isActive,
    page = 1,
    limit = 15,
    remote,
  } = req.query;

  let query = { recruiter: recruiterId };

  if (search) {
    const tags = await Tag.find({ name: { $regex: search, $options: "i" } }).select("_id");
    const tagIds = tags.map((tag) => tag._id);
    const categories = await Category.find({ name: { $regex: search, $options: "i" } }).select("_id");
    const categoryIdsFromSearch = categories.map((c) => c._id);

    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { requirements: { $regex: search, $options: "i" } },
      { tags: { $in: tagIds } },
      { category: { $in: categoryIdsFromSearch } },
      { country: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { jobLevel: { $regex: search, $options: "i" } },
    ];
  }

  if (categoryId) query.category = categoryId;
  if (jobType) query.jobType = jobType;
  if (experience) query.experience = experience;
  if (remote !== undefined) query.remote = remote === "true";
  if (typeof isActive !== "undefined") {
    query.isActive = typeof isActive === "string" ? isActive === "true" : !!isActive;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const jobs = await Job.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "category", select: "name" })
    .populate({ path: "company", select: "name logo" })
    .populate({ path: "tags", select: "name" })
    .sort({ createdAt: -1 })
    .lean();

  const total = await Job.countDocuments(query);

  res.json(
    toResultOk({
      msg: MESSAGE.JOB_FETCH_SUCCESS,
      data: {
        jobs,
        totalPages: Math.ceil(total / limit),
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};

// get number of application of a job by job id
export const getNumberOfApplicationsByJobId = async (req, res) => {
  const { jobId } = req.params;
  const count = await Application.countDocuments({ job: jobId });
  res.json(toResultOk({ msg: MESSAGE.JOB_FETCH_SUCCESS, data: { count } }));
};

//get candidate applications for a job by job id
export const getApplicationsByJobId = async (req, res) => {
  const { jobId } = req.params;
  const applications = await Application.find({ job: jobId })
    .populate({ path: 'job', select: 'title role' })
    .populate({ path: 'candidate', select: 'firstName lastName email phoneNumber avatar resume' })
    .sort({ createdAt: -1 })
    .lean();

  const candidateIds = applications
    .map(app => app.candidate?._id)
    .filter(Boolean);

  let profilesByUserId = new Map();
  if (candidateIds.length) {
    const profiles = await Profile.find({ user: { $in: candidateIds } })
      .select('user experience education')
      .lean();
    profilesByUserId = new Map(profiles.map(profile => [String(profile.user), profile]));
  }

  const formattedApplications = applications.map(app => {
    const candidate = app.candidate || {};
    const profile = candidate._id ? profilesByUserId.get(String(candidate._id)) : undefined;

    return {
      _id: app._id,
      candidateName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim(),
      role: app.job?.role || '',
      experience: profile?.experience || '',
      education: profile?.education || '',
      appliedDate: app.createdAt,
      avatar: candidate.avatar || '',
      resume: app.resume || '',
      email: candidate.email || '',
      phone: candidate.phoneNumber || '',
      status: app.status || '',
      cv : profile?.cv || ''
    };
  });

  res.json(toResultOk({ msg: MESSAGE.JOB_APPLICATIONS_FETCH_SUCCESS, data: formattedApplications }));
};

// toggle job status by id
export const toggleJobStatus = async (req, res) => {
  const { id } = req.params;
  const job = await Job.findById(id);
  if (!job) {
    throw new ErrorResponse(404, MESSAGE.JOB_NOT_FOUND);
  }
  job.isActive = !job.isActive;
  await job.save();

  res.json(toResultOk({ msg: MESSAGE.JOB_STATUS_TOGGLE_SUCCESS, data: job }));
};