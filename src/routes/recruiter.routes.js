import express from 'express';
import { 
  getRecruiterStats, 
  getRecentlyPostedJobs,
  getRecruiterProfile,
  updateRecruiterProfile
} from '../controllers/recruiter.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { recruiterMiddleware } from '../middlewares/recruiter.middleware.js';
import { wrapAsync } from '../middlewares/error.middleware.js';

const router = express.Router();

// Apply authentication and recruiter middleware to all routes
router.use(authMiddleware, recruiterMiddleware);

// Get recruiter statistics (open jobs count, saved candidates count)
router.get('/stats', wrapAsync(getRecruiterStats));

// Get recently posted jobs for recruiter
router.get('/recent-jobs', wrapAsync(getRecentlyPostedJobs));

// Get recruiter profile information
router.get('/profile', wrapAsync(getRecruiterProfile));

// Update recruiter profile information
router.put('/profile', wrapAsync(updateRecruiterProfile));

export default router;