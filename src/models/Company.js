import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  logo: { type: String },
  banner: { type: String },
  description: { type: String },
  benefits: { type: String },
  vision: { type: String },
  social: {
    facebook: { type: String },
    linkedin: { type: String },
    twitter: { type: String },
    youtube: { type: String },
  },
  contact: {
    email: { type: String },
    phone: { type: String },
    website: { type: String },
  },
  foundedDate: { type: Date },
  teamSize: { type: Number },
  address: { type: String },
  industry: { type: String },
});

export default mongoose.model("Company", CompanySchema);
