import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

let client;
let index;

function ensureClient() {
  if (client) return client;
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is not set");
  }
  client = new Pinecone({ apiKey });
  return client;
}

export async function initPinecone() {
  if (index) return index;
  const indexName = process.env.PINECONE_INDEX_NAME;
  const indexHost = process.env.PINECONE_INDEX_HOST;
  const nameSpace = process.env.PINECONE_NAME_SPACE || "default";
  if (!indexName || !indexHost) {
    throw new Error("PINECONE_INDEX_NAME and PINECONE_INDEX_HOST are not set");
  }
  ensureClient();
  const baseIndex = client.index(indexName, indexHost);
  index = baseIndex.namespace(nameSpace);
  return index;
}

export async function upsertItems(items) {
  await initPinecone();
  await index.upsert(items);
}

export async function queryEmbedding(embedding, topK = 5) {
  await initPinecone();
  const queryRes = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    includeValues: false,
  });
  return queryRes.matches.map((m) => ({
    id: m.id,
    score: m.score,
    text: m.metadata?.text,
  }));
}

export async function deleteItems(ids) {
  await initPinecone();
  await index.deleteMany(ids);
}
