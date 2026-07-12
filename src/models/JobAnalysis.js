
import mongoose from 'mongoose';

const JobAnalysisSchema = new mongoose.Schema({
  candidate_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  job_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Job', 
    required: true 
  },
  match_score: { type: Number },
  analysis_details: { type: String },
  analysis_at: { type: Date, default: Date.now }
});

export default mongoose.model('JobAnalysis', JobAnalysisSchema);
