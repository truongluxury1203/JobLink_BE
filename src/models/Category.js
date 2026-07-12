
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    maxlength: 100 
  },
  description: { type: String, maxlength: 255 }
},
{ timestamps: true }
);

export default mongoose.model('Category', CategorySchema);
