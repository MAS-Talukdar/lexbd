
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

// Security Headers
app.use(helmet());

// Frontend-Backend Communication
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:5500"
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

// Read JSON Request
app.use(express.json({ limit: "1mb" }));

// Read URL Encoded Data
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bangladesh Case Law Directory API is running",
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

export default app;
