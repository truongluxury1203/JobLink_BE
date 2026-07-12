import mongoose from 'mongoose';

const JobFavoriteSchema = new mongoose.Schema({
  candidate: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', required: true 
  },
  job: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Job', required: true 
  }
},
{ timestamps: true }
);

export default mongoose.model('JobFavorite', JobFavoriteSchema);