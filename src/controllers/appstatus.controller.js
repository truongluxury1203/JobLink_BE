import Application from "../models/Application.js";
import Candidate from "../models/User.js";
import Job from "../models/Job.js";
import { toResultOk, toResultError } from "../results/Result.js";
import { MESSAGE } from "../constants/message.js";

// ứng tuyển công việc
export const applyJob = async (req, res) => {
  const { candidateId, jobId, resume, coverLetter } = req.body;

  try {
    const job = await Job.findById(jobId);
    if (!job)
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: MESSAGE.JOB_NOT_FOUND }));

    const existing = await Application.findOne({ candidate: candidateId, job: jobId });
    if (existing)
      return res
        .status(400)
        .json(toResultError({ statusCode: 400, msg: MESSAGE.DUPLICATE_DATA }));

    const application = await Application.create({
      candidate: candidateId,
      job: jobId,
      resume,
      coverLetter,
      status: "Pending",
    });

    return res.json(
      toResultOk({ msg: MESSAGE.APPLY_JOB_SUCCESS, data: application })
    );
  } catch (err) {
    console.error(MESSAGE.APPLY_JOB_FAILED);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.APPLY_JOB_FAILED }));
  }
};

// xem trạng thái ứng tuyển của ứng viên
export const viewApplicationStatus = async (req, res) => {
  try {
    const { candidate_id } = req.params;

    const applications = await Application.find({ candidate: candidate_id })
      .populate("job", "title company")
      .sort({ createdAt: -1 });

    return res.json(
      toResultOk({
        msg: MESSAGE.APPLICATION_STATUS_FETCH_SUCCESS,
        data: applications,
      })
    );
  } catch (err) {
    console.error(MESSAGE.APPLICATION_STATUS_FETCH_FAILED);
    return res
      .status(500)
      .json(
        toResultError({
          statusCode: 500,
          msg: MESSAGE.APPLICATION_STATUS_FETCH_FAILED,
        })
      );
  }
};

// tải CV
export const importCV = async (req, res) => {
  try {
    const { candidateId, cv } = req.body;

    if (!candidateId || !cv) {
      return res
        .status(400)
        .json(toResultError({ statusCode: 400, msg: MESSAGE.VALIDATION_ERROR }));
    }

    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: MESSAGE.NOT_FOUND }));
    }

    candidate.cv = cv;
    await candidate.save({ validateBeforeSave: false }); //  bỏ validation 

    return res.json(
      toResultOk({
        msg: MESSAGE.CV_IMPORT_SUCCESS,
        data: { id: candidate._id, cv: candidate.cv },
      })
    );
  } catch (err) {
    console.error(MESSAGE.CV_IMPORT_FAILED);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.CV_IMPORT_FAILED }));
  }
};

// xóa CV
export const deleteCV = async (req, res) => {
  try {
    const { candidate_id } = req.params;

    const candidate = await User.findById(candidate_id);
    if (!candidate) {
      return res
        .status(404)
        .json(toResultError({ statusCode: 404, msg: MESSAGE.NOT_FOUND }));
    }

    candidate.cv = null;
    await candidate.save({ validateBeforeSave: false }); // bỏ validation 

    return res.json(toResultOk({ msg: MESSAGE.CV_DELETE_SUCCESS }));
  } catch (err) {
    console.error(MESSAGE.CV_DELETE_FAILED);
    return res
      .status(500)
      .json(toResultError({ statusCode: 500, msg: MESSAGE.CV_DELETE_FAILED }));
  }
};