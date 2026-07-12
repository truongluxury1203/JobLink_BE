import express from 'express';
import { 
    getAllJobs, 
    getAllJobsWithAuth,
    createJob,
    getJobById,
    getJobByIdWithAuth,
    updateJob,
    getJobsByRecruiterId,
    toggleFavoriteAJob,
    getNumberOfApplicationsByJobId,
    getApplicationsByJobId,
    toggleJobStatus,
    // expireJobById
} from '../controllers/job.controller.js';
import { wrapAsync } from '../middlewares/error.middleware.js';
import { authMiddleware} from '../middlewares/auth.middleware.js';
import { recruiterMiddleware } from '../middlewares/recruiter.middleware.js';

const jobRoutes = express.Router();


// get all jobs
jobRoutes.get('/list/public', wrapAsync(getAllJobs));

// get job by id
jobRoutes.get('/details/:id/public', wrapAsync(getJobById));

///////////////////////////////////////////////////////////////////
// use auth middleware
jobRoutes.use(authMiddleware);

// get favorite jobs
jobRoutes.get('/list/auth', wrapAsync(getAllJobsWithAuth));

// get favorite job details when logged in
jobRoutes.get('/details/:id/auth', wrapAsync(getJobByIdWithAuth));

// favorite a job
jobRoutes.post('/favorite/:jobId', wrapAsync(toggleFavoriteAJob));

/////////////////////////////////////////////////////////////////
// use recruiter middleware
jobRoutes.use(recruiterMiddleware);

// // expire job by id
// jobRoutes.patch('/expire/:id', wrapAsync(expireJobById));

// toggle job status by id
jobRoutes.patch('/status/:id', wrapAsync(toggleJobStatus));

// get number of applications of a job by job id
jobRoutes.get('/applications/count/:jobId', wrapAsync(getNumberOfApplicationsByJobId));

//get applications for a job by job id
jobRoutes.get('/applications/:jobId', wrapAsync(getApplicationsByJobId));

// create new job
jobRoutes.post('/post', wrapAsync(createJob));

// update job by id
jobRoutes.put('/edit/:id', wrapAsync(updateJob));

// get jobs by recruiter id
jobRoutes.get('/recruiter/my-jobs', wrapAsync(getJobsByRecruiterId));



export default jobRoutes;
