import mongoose from "mongoose";
const ProfileSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    experience: { type: String, maxlength: 1000 },
    education: { type: String, maxlength: 1000 },
    bio: { type: String, maxlength: 500 },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    cv: { type: String },
    location: { type: String, maxlength: 100 },
    social: {
        linkedin: { type: String, maxlength: 100 },
        twitter: { type: String, maxlength: 100 },
        facebook: { type: String, maxlength: 100 },
        instagram: { type: String, maxlength: 100 },
      },
    },
    { timestamps: true }
);

export default mongoose.model("Profile", ProfileSchema);
