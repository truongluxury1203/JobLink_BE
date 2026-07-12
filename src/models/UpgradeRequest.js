import mongoose from "mongoose";

const UpgradeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyInfo: {
      name: { type: String, required: true },
      logo: { type: String },
      banner: { type: String },
      description: { type: String },
      benefits: { type: String },
      vision: { type: String },
      contact: {
        email: { type: String },
        phone: { type: String },
        website: { type: String },
      },
      industry: { type: String },
      address: { type: String },
    },
    businessLicense: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin
    },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// Add indexes for better query performance
UpgradeRequestSchema.index({ createdAt: -1 }); // For sorting by creation date
UpgradeRequestSchema.index({ status: 1 }); // For filtering by status
UpgradeRequestSchema.index({ user: 1 }); // For finding user's requests
UpgradeRequestSchema.index({ status: 1, createdAt: -1 }); // Compound index for common query pattern

export default mongoose.model("UpgradeRequest", UpgradeRequestSchema);
