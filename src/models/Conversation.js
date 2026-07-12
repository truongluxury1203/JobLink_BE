import mongoose from "mongoose";

const Conversation = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", Conversation);
