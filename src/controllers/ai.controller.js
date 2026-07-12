import express from "express";

import { queryEmbedding } from "../lib/vectorstores/pineconeStore.js";
import openai from "../configs/openAI.js";
import Conversation from "../models/Conversation.js";
import Chatbot from "../models/Chatbot.js";
import { AI_SYSTEM_PROMPT, buildCandidateUserPrompt } from "../lib/promts/promts.js";
import { getEmbedding } from "../lib/vectorstores/embedding.js";
import { getHistoryContext } from "../lib/vectorstores/context.js";
import { FRONTEND_ROUTES } from "../constants/variable.js";
const router = express.Router();

export const aiCandidateController = async (req, res) => {
  try {
    let { question, topK = 10, conversationId } = req.body;
    // ensure topK is a number and clamp to a reasonable max to avoid huge queries
    topK = Number(topK) || 10; // Increased default from 5 to 10 for better filtering
    const MAX_TOPK = 20; // Increased max from 10 to 20
    if (topK > MAX_TOPK) topK = MAX_TOPK;
    let conversation;
    const userId = req.user._id;

    if (!question) return res.status(400).json({ error: "missing question" });

    console.log(`AI debug: question="${question}", requested topK=${topK}`);

    // 1. embed question
    const qEmbedding = await getEmbedding(question);
    // 2. search vector DB
    const matches = await queryEmbedding(qEmbedding, topK);
    console.log(`AI debug: pinecone returned ${matches.length} matches (topK=${topK})`);

    // 3. history conversation (if not new)
    if (!conversationId) {
      conversation = new Conversation({
        user_id: userId,
        title: question.slice(0, 50) || "Cuộc trò chuyện mới",
      });
      await conversation.save();
    } else {
      conversation = await Conversation.find({ _id: conversationId, user_id: userId });
    }

    const historyContext = await getHistoryContext(conversation._id);

    // Create context with job IDs for linking
    const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const context = matches
      .map((m, i) => {
        const jobLink = `${frontendUrl}${FRONTEND_ROUTES.JOB_DETAILS}/${m.id}`;
        // Try to extract a Title from the metadata text to help the LLM
        const text = m.text || "";
        const titleMatch = text.match(/Title:\s*(.*)/i);
        const jobTitle = titleMatch ? titleMatch[1].trim() : "(Không có tiêu đề)";
        return `Context ${i + 1} (Độ liên quan: ${m.score?.toFixed(3)}):\n[JOB_ID]: ${m.id}\n[JOB_TITLE]: ${jobTitle}\n[JOB_LINK]: ${jobLink}\n[JOB_INFO]:\n${text}`;
      })
      .join("\n\n========================================\n\n");

    // 4. ask LLM
    const systemPrompt = AI_SYSTEM_PROMPT.CANDIDATE_PROMPT;

    const userPrompt = buildCandidateUserPrompt({
      historyContext,
      matches,
      context,
      question,
    });
    const completion = await openai.chat.completions.create({
      model: process.env.LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 6000,
      temperature: 0.3,
    });

    const answer = completion.choices[0].message.content;

    //  Lưu message người dùng và AI
    await Chatbot.create([
      { conversation_id: conversation._id, message: question, isAI: false },
      { conversation_id: conversation._id, message: answer, isAI: true },
    ]);

    return res.json({ conversation_id: conversation._id, answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

export default router;
