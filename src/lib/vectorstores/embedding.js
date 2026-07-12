import openai from "../../configs/openAI.js";
import { config } from "dotenv";
config();

export const getEmbedding = async (text) => {
  const response = await openai.embeddings.create({
    model: process.env.EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
};
