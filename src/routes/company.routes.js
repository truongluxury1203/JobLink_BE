import express from "express";
import {
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyOfRecruiter,
  getCompanyByRecruiterId,
  getAllCompanies,
  getAllCompaniesByLocation,
} from "../controllers/company.controller.js";
import { wrapAsync } from "../middlewares/error.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { recruiterMiddleware } from "../middlewares/recruiter.middleware.js";

const companyRoutes = express.Router();
// Routes có parameter phải đặt SAU routes cụ thể
// Routes cụ thể phải đặt TRƯỚC routes có parameter
// get company by recruiter ID

// get all companies
companyRoutes.get("/", getAllCompanies);

// get companies by location
companyRoutes.get("/location", getAllCompaniesByLocation);

companyRoutes.get('/details/:id', wrapAsync(getCompanyById));
companyRoutes.use(authMiddleware, recruiterMiddleware);
companyRoutes.get("/recruiter/my-company", wrapAsync(getCompanyOfRecruiter));
companyRoutes.get("/recruiter/:recruiterId", wrapAsync(getCompanyByRecruiterId));
companyRoutes.get("/:id", wrapAsync(getCompanyById));
// update company by id
companyRoutes.put("/edit/:id", wrapAsync(updateCompany));
// create new company
companyRoutes.post("/create", wrapAsync(createCompany));
// delete company by id
companyRoutes.delete("/:id", wrapAsync(deleteCompany));

export default companyRoutes;
