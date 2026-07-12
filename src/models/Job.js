import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company' 
  },
  recruiter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category' 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { type: String },
  tags: { 
    type: [mongoose.Schema.Types.ObjectId], 
    ref: 'Tag'
  },
  role: { type: String },
  minSalary: { type: Number },
  maxSalary: { type: Number },
  salaryType: { type: String },
  education: { type: String },
  experience: { type: String },
  jobType: { 
    type: String, 
    default: "FULL-TIME", 
    enum: ["FULL-TIME", "PART-TIME", "CONTRACT BASE", "TEMPORARY", "INTERNSHIP", "VOLUNTEER", "OTHER"] 
  },
  vacancies: { type: Number },
  expiration: { type: Date },
  jobLevel: { type: String },
  country: { type: String },
  city: { type: String },
  remote: { type: Boolean, default: false },
  benefits: { type: String },
  applyType: { type: String, default: "Jobpilot" },  
  requirements: { type: String },
  desirable: { type: String },
  location: { type: String },
  isActive: { type: Boolean, default: true }
},
{ timestamps: true }
);



export default mongoose.model('Job', JobSchema);