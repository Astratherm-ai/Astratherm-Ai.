const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "8mb" }));
app.use(express.static(__dirname));

app.get("/api/status", (req, res) => {
  res.json({ configured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI_NOT_CONFIGURED" });
    }

    const { message, image, history = [] } = req.body;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const parts = [{
      text: message || "Explain this image educationally."
    }];

    if (image?.data && image?.mimeType) {
      parts.push({
        inlineData: {
          data: image.data,
          mimeType: image.mimeType
        }
      });
    }

    const contents = [
      ...history.slice(-10).map(item => ({
        role: item.role,
        parts: [{ text: item.text }]
      })),
      { role: "user", parts }
    ];

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction:
          "You are ASTRA AI, an educational space-science assistant for ASTRATHERM. Explain science, spacecraft concepts and safe school projects. Do not provide instructions for constructing, powering, launching or modifying real rockets or propulsion systems."
      }
    });

    res.json({ reply: result.text || "Please try asking another question." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`ASTRA AI server running on port ${PORT}`);
});
