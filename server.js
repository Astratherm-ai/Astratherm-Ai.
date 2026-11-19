import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

if (!process.env.GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY is not set in environment variables.");
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(express.json({ limit: "8mb" }));
app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "astratherm-ai",
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "Server is missing GEMINI_API_KEY configuration."
      });
    }

    const { message = "", imageBase64 = "", mimeType = "", history = [] } = req.body || {};
    const cleanMessage = String(message).trim();

    if (!cleanMessage && !imageBase64) {
      return res.status(400).json({ error: "Please enter a message or attach an image." });
    }

    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-10)) {
        if (turn && (turn.role === "user" || turn.role === "model") && typeof turn.text === "string") {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text.slice(0, 4000) }]
          });
        }
      }
    }

    const currentParts = [];
    if (imageBase64 && mimeType) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ error: "Unsupported image format." });
      }
      currentParts.push({
        inlineData: {
          data: imageBase64,
          mimeType
        }
      });
    }

    currentParts.push({
      text: cleanMessage || "Analyze this image and provide a helpful response."
    });

    contents.push({
      role: "user",
      parts: currentParts
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction:
          "You are ASTRATHERM AI, a helpful, clear, and concise assistant."
      }
    });

    return res.status(200).json({
      reply: response.text || "No response text returned."
    });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      error: "Failed to generate AI response."
    });
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`ASTRATHERM AI running on port ${PORT}`);
});
