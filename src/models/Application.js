import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    coverLetter: { type: String },
    status: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Application", ApplicationSchema);
