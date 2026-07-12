import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import connectDB from "./databases/databaseConnect.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import appRoutes from "./routes/app.routes.js";
import cookieParser from "cookie-parser";
import { initSocketServer } from "./lib/socket/index.js";

dotenv.config();
const app = express();

const resolveOrigins = () => {
  const origin = process.env.CLIENT_URL || "http://localhost:5173";
  return origin
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

// Middleware setup
app.use(
  cors({
    origin: resolveOrigins(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse JSON bodies
app.use(express.json());
app.use(cookieParser());
// Connect to the database
connectDB();

// Health check route
app.get("/api/sync", (req, res) => {
  // Sync logic here
  res.status(200).json({ message: "Sync successful" });
});

// Routes
app.use("/api", appRoutes);

// Error handling middleware
app.use(errorHandler);

// Start the server with Socket.io
const server = http.createServer(app);
initSocketServer(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, server };
export default app;
