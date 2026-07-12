import mongoose from 'mongoose';

const JobSavedSchema = new mongoose.Schema({
  candidate_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  saved_at: { type: Date, default: Date.now }
});

const JobSaved = mongoose.model('JobSaved', JobSavedSchema);
export default JobSaved;