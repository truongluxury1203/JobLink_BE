import Chatbot from "../../models/Chatbot.js";

export const getHistoryContext = async (conversationId) => {
  const history = await Chatbot.find({ conversation_id: conversationId })
    .sort({ createdAt: -1 })
    .lean();
  return history.map((msg) => `${msg.isAI ? "AI Assistant" : "User"}: ${msg.message}`).join("\n");
};
