import express from 'express';
import { applyJob, viewApplicationStatus, importCV, deleteCV } from '../controllers/appstatus.controller.js';
import { wrapAsync } from '../middlewares/error.middleware.js';
import { authMiddleware} from '../middlewares/auth.middleware.js';

const appstatusRoutes = express.Router();

// appstatusRoutes.use(authMiddleware);

// Apply for a job
appstatusRoutes.post('/apply', wrapAsync(applyJob));

// View application status for a candidate
appstatusRoutes.get('/status/:candidate_id', wrapAsync(viewApplicationStatus));

// Import/Create new CV
appstatusRoutes.post('/cv/import', wrapAsync(importCV));

// Delete existing CV
appstatusRoutes.delete('/cv/delete/:candidate_id', wrapAsync(deleteCV));

export default appstatusRoutes;
