// src/controllers/application.controller.js
import Application from "../models/Application.js";
import { MESSAGE } from "../constants/message.js";
import { toResultOk, toResultError } from "../results/Result.js";
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import Profile from "../models/Profile.js";
import axios from "axios";
import { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY } from "../constants/notification.js";
import { notifyUser } from "../services/notification.service.js";

// Apply for a job
export const applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if user is authenticated
    if (!req.user) {
      return res
        .status(401)
        .json(toResultError({ statusCode: 401, msg: "Authentication required to apply for jobs" }));
    }

    const candidateId = req.user._id;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      candidate: candidateId,
    });

    console.log("recruiterId:");
    if (existingApplication) {
      return res.status(400).json(toResultError({ statusCode: 400, msg: MESSAGE.ALREADY_APPLIED }));
    }

    // Lấy CV từ Profile của candidate
    const profile = await Profile.findOne({ user: candidateId }).select("cv");
    if (!profile || !profile.cv) {
      return res
        .status(400)
        .json(toResultError({ statusCode: 400, msg: "Candidate CV not found in profile" }));
    }

    const { coverLetter } = req.body;

    // Create new application with timestamp
    const application = new Application({
      job: jobId,
      candidate: candidateId,
      coverLetter: coverLetter || "",
      status: "pending",
      appliedDate: new Date(),
    });

    await application.save();

    let recruiterId = job.recruiter;
    if (!recruiterId && job.company) {
      const company = await Company.findById(job.company).select("recruiter").lean();
      recruiterId = company?.recruiter || null;
    }

    const candidateName = `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim();
    const jobTitle = job.title || "Công việc";

    const notifications = [];
    if (recruiterId) {
      notifications.push(
        notifyUser({
          userId: recruiterId,
          senderId: candidateId,
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
            url: "/recruiter/applications",
          },
        })
      );
    }

    notifications.push(
      notifyUser({
        userId: candidateId,
        senderId: recruiterId || null,
        title: "Ứng tuyển thành công",
        message: `Bạn đã ứng tuyển thành công vị trí ${jobTitle}.`,
        category: NOTIFICATION_CATEGORY.APPLICATION,
        priority: NOTIFICATION_PRIORITY.SUCCESS,
        metadata: {
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
        },
        action: {
          label: "Theo dõi ứng tuyển",
          url: "/candidate/applied-jobs",
        },
      })
    );

    await Promise.allSettled(notifications);

    // Trả về kèm CV từ profile cho recruiter sử dụng ngay
    const enriched = { ...application.toObject(), resume: profile.cv };
    return res.status(201).json(toResultOk({ data: enriched }));
  } catch (error) {
    console.error("Error applying for job:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

// Get all candidates for a specific job
export const getCandidatesInJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if job exists
    const job = await Job.findById(jobId).populate("company");
    if (!job) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));
    }

    // Find the recruiter's company
    const recruiterCompany = await Company.findOne({ recruiter: req.user._id });
    if (!recruiterCompany) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "No company found for this recruiter" }));
    }

    // Verify the recruiter has access to this job
    if (job.company._id.toString() !== recruiterCompany._id.toString()) {
      return res.status(403).json(toResultError({ statusCode: 403, msg: MESSAGE.UNAUTHORIZED }));
    }

    // Find all applications for this job with candidate details
    const applications = await Application.find({ job: jobId })
      .populate({
        path: "candidate",
        select: "firstName lastName email phoneNumber avatar",
      })
      .populate({
        path: "job",
        select: "title company role location jobType",
        populate: {
          path: "company",
          select: "name logo",
        },
      })
      .sort({ createdAt: -1 });

    // Lấy CV từ profile cho toàn bộ candidate trong danh sách
    const candidateIds = applications.map((a) => a.candidate?._id || a.candidate);
    const profiles = await Profile.find({ user: { $in: candidateIds } }).select("user cv");
    const cvMap = new Map(profiles.map((p) => [p.user.toString(), p.cv || null]));
    const enriched = applications.map((a) => {
      const obj = a.toObject ? a.toObject() : { ...a };
      return {
        ...obj,
        // ensure resume and coverLetter are present at top level for frontend
        resume: cvMap.get((a.candidate?._id || a.candidate).toString()) || null,
        coverLetter: obj.coverLetter || obj.coverLetter === "" ? obj.coverLetter : null,
      };
    });

    return res.status(200).json(toResultOk({ data: enriched }));
  } catch (error) {
    console.error("Error getting candidates in job:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

// Filter candidates by status in a specific job
export const filterCandidatesByStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.query;

    if (!status) {
      return res.status(400).json(toResultError({ statusCode: 400, msg: MESSAGE.MISSING_FIELDS }));
    }

    // Check if job exists and belongs to the recruiter's company
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));
    }

    // Verify the recruiter has access to this job
    if (job.company.toString() !== req.user.company.toString()) {
      return res.status(403).json(toResultError({ statusCode: 403, msg: MESSAGE.UNAUTHORIZED }));
    }

    // Find all applications for this job with the specified status
    const applications = await Application.find({
      job: jobId,
      status: status,
    }).populate({
      path: "candidate",
      select: "fullName email phone avatar",
    });

    const candidateIds = applications.map((a) => a.candidate?._id || a.candidate);
    const profiles = await Profile.find({ user: { $in: candidateIds } }).select("user cv");
    const cvMap = new Map(profiles.map((p) => [p.user.toString(), p.cv || null]));
    const enriched = applications.map((a) => ({
      ...a.toObject(),
      resume: cvMap.get((a.candidate?._id || a.candidate).toString()) || null,
    }));

    return res.status(200).json(toResultOk({ data: enriched }));
  } catch (error) {
    console.error("Error filtering candidates by status:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

// Get all applications for recruiter's company jobs
export const getAllApplicationsByRecruiter = async (req, res) => {
  try {
    // Check if user is authenticated and is a recruiter
    if (!req.user) {
      return res
        .status(401)
        .json(
          toResultError({ statusCode: 401, msg: "Authentication required and must be a recruiter" })
        );
    }

    // Find company by recruiter ID
    const company = await Company.findOne({ recruiter: req.user._id });
    if (!company) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "No company found for this recruiter" }));
    }

    const companyId = company._id;

    // Find all jobs belonging to the recruiter's company
    const companyJobs = await Job.find({ company: companyId }).select("_id");
    const jobIds = companyJobs.map((job) => job._id);

    // Find all applications for these jobs
    const applications = await Application.find({
      job: { $in: jobIds },
    })
      .populate({
        path: "candidate",
        select: "firstName lastName email phoneNumber avatar",
      })
      .populate({
        path: "job",
        select: "title company role location jobType",
        populate: {
          path: "company",
          select: "name logo",
        },
      })
      .sort({ createdAt: -1 }); // Sort by newest first

    const candidateIds = applications.map((a) => a.candidate?._id || a.candidate);
    const profiles = await Profile.find({ user: { $in: candidateIds } }).select("user cv");
    const cvMap = new Map(profiles.map((p) => [p.user.toString(), p.cv || null]));
    const enriched = applications.map((a) => ({
      ...a.toObject(),
      resume: cvMap.get((a.candidate?._id || a.candidate).toString()) || null,
    }));

    return res.status(200).json(toResultOk({ data: enriched }));
  } catch (error) {
    console.error("Error getting all applications by recruiter:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

// Get shortlisted applications for recruiter's company jobs
export const getShortlistedApplicationsByRecruiter = async (req, res) => {
  try {
    // Check if user is authenticated and is a recruiter
    if (!req.user) {
      return res
        .status(401)
        .json(
          toResultError({ statusCode: 401, msg: "Authentication required and must be a recruiter" })
        );
    }

    // Find company by recruiter ID
    const company = await Company.findOne({ recruiter: req.user._id });
    if (!company) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "No company found for this recruiter" }));
    }

    const companyId = company._id;

    // Find all jobs belonging to the recruiter's company
    const companyJobs = await Job.find({ company: companyId }).select("_id");
    const jobIds = companyJobs.map((job) => job._id);

    // Find all shortlisted applications for these jobs
    const shortlistedApplications = await Application.find({
      job: { $in: jobIds },
      status: "shortlisted", // Assuming "shortlisted" is the status for shortlisted applications
    })
      .populate({
        path: "candidate",
        select: "firstName lastName email phoneNumber avatar",
      })
      .populate({
        path: "job",
        select: "title company role location jobType",
        populate: {
          path: "company",
          select: "name logo",
        },
      })
      .sort({ createdAt: -1 }); // Sort by newest first

    return res.status(200).json(toResultOk({ data: shortlistedApplications }));
  } catch (error) {
    console.error("Error getting shortlisted applications by recruiter:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json(toResultError({ statusCode: 400, msg: MESSAGE.MISSING_FIELDS }));
    }

    const allowedStatuses = ["pending", "shortlisted", "interview", "rejected", "hired"];
    const normalizedStatus = String(status).trim().toLowerCase();

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json(
        toResultError({
          statusCode: 400,
          msg: "Invalid status. Allowed: pending, shortlisted, interview, rejected, hired",
        })
      );
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: "Application not found" }));
    }

    // Verify recruiter has access to this job (belongs to their company)
    const job = await Job.findById(application.job).populate("company");
    if (!job) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));
    }

    const recruiterCompany = await Company.findOne({ recruiter: req.user._id });
    if (!recruiterCompany) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "No company found for this recruiter" }));
    }

    if (job.company._id.toString() !== recruiterCompany._id.toString()) {
      return res.status(403).json(toResultError({ statusCode: 403, msg: MESSAGE.UNAUTHORIZED }));
    }

    // Transition rules: forward-only, with terminal statuses
    const currentStatus = String(application.status || "pending").toLowerCase();
    const allowedNext = {
      pending: ["shortlisted", "interview", "rejected"],
      shortlisted: ["interview", "rejected"],
      interview: ["hired", "rejected"],
      hired: [],
      rejected: [],
    };

    // No change
    if (normalizedStatus === currentStatus) {
      return res.status(400).json(toResultError({ statusCode: 400, msg: "Status is unchanged" }));
    }

    // Terminal check
    if (["hired", "rejected"].includes(currentStatus)) {
      return res.status(400).json(
        toResultError({
          statusCode: 400,
          msg: `Cannot update status from terminal state: ${currentStatus}`,
        })
      );
    }

    // Validate forward transition
    const nextAllowed = allowedNext[currentStatus] || [];
    if (!nextAllowed.includes(normalizedStatus)) {
      return res.status(400).json(
        toResultError({
          statusCode: 400,
          msg: `Invalid transition from '${currentStatus}' to '${normalizedStatus}'`,
        })
      );
    }

    application.status = normalizedStatus;
    await application.save();

    const populatedApplication = await Application.findById(applicationId)
      .populate({
        path: "candidate",
        select: "firstName lastName email phoneNumber avatar",
      })
      .populate({
        path: "job",
        select: "title company role location jobType",
        populate: {
          path: "company",
          select: "name logo",
        },
      });

    const statusLabels = {
      pending: "đang chờ xử lý",
      shortlisted: "được đưa vào danh sách phỏng vấn",
      interview: "được mời phỏng vấn",
      hired: "được tuyển dụng",
      rejected: "bị từ chối",
    };

    const statusPriorityMap = {
      rejected: NOTIFICATION_PRIORITY.WARNING,
      hired: NOTIFICATION_PRIORITY.SUCCESS,
    };

    const jobTitle = populatedApplication?.job?.title || "công việc";
    const recruiterName = `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim();

    await notifyUser({
      userId: populatedApplication?.candidate?._id || application.candidate,
      senderId: req.user?._id,
      title: "Cập nhật trạng thái ứng tuyển",
      message: `Trạng thái ứng tuyển của bạn cho vị trí ${jobTitle} đã được ${recruiterName || "nhà tuyển dụng"} cập nhật thành ${statusLabels[normalizedStatus] || normalizedStatus}.`,
      category: NOTIFICATION_CATEGORY.APPLICATION,
      priority: statusPriorityMap[normalizedStatus] || NOTIFICATION_PRIORITY.INFO,
      metadata: {
        applicationId: application._id.toString(),
        jobId: application.job.toString(),
        status: normalizedStatus,
      },
      action: {
        label: "Xem chi tiết",
        url: "/candidate/applied-jobs",
      },
    }).catch(() => null);

    return res.status(200).json(
      toResultOk({
        data: populatedApplication,
      })
    );
  } catch (error) {
    console.error("Error updating application status:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};

export const downloadApplicationCv = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!req.user) {
      return res.status(401).json(toResultError({ statusCode: 401, msg: MESSAGE.UNAUTHORIZED }));
    }

    const application = await Application.findById(applicationId)
      .populate({
        path: "job",
        select: "company",
        populate: { path: "company", select: "_id name" },
      })
      .populate({ path: "candidate", select: "firstName lastName email" });

    if (!application) {
      return res.status(404).json(toResultError({ statusCode: 404, msg: "Application not found" }));
    }

    const recruiterCompany = await Company.findOne({ recruiter: req.user._id });
    if (!recruiterCompany) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "No company found for this recruiter" }));
    }

    const appCompanyId = application.job?.company?._id || application.job?.company;
    if (!appCompanyId || String(appCompanyId) !== String(recruiterCompany._id)) {
      return res.status(403).json(toResultError({ statusCode: 403, msg: MESSAGE.UNAUTHORIZED }));
    }

    const candidateId = application.candidate?._id || application.candidate;
    const profile = await Profile.findOne({ user: candidateId }).select("cv");

    const parseCvFieldLocal = (value) => {
      if (!value) return null;
      if (typeof value === "object" && value.url) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === "object") return parsed;
        } catch {
          return { url: value };
        }
      }
      return null;
    };

    const cvData = parseCvFieldLocal(profile?.cv);
    const cvUrl = cvData?.url;

    if (!cvUrl) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: "Candidate CV not found" }));
    }

    const fullName = [application.candidate?.firstName || "", application.candidate?.lastName || ""]
      .filter(Boolean)
      .join(" ")
      .trim();
    const suggestedName =
      (fullName ? `${fullName} - CV` : "cv") +
      (cvData?.mimeType === "application/pdf" ? ".pdf" : "");
    const safeFilename = suggestedName.replace(/[^\w\-.\s]/g, "").slice(0, 120) || "cv.pdf";

    try {
      const response = await axios.get(cvUrl, { responseType: "stream" });
      const contentType =
        cvData?.mimeType || response.headers["content-type"] || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);

      response.data.pipe(res);
    } catch (err) {
      console.error("downloadApplicationCv error streaming:", err?.message || err);
      return res
        .status(502)
        .json(toResultError({ statusCode: 502, msg: "Unable to fetch CV from storage" }));
    }
  } catch (error) {
    console.error("downloadApplicationCv error:", error);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.INTERNAL_SERVER_ERROR }));
  }
};
