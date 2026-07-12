import mongoose from "mongoose";

const ChatbotSchema = new mongoose.Schema(
  {
    message: { type: String },
    isAI: { type: Boolean, default: false },
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  },
  { timestamps: true }
);

export default mongoose.model("Chatbot", ChatbotSchema);
