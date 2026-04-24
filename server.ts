import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini for API usage (External apps like Android)
const ai_backend = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

// API Route for chat (compatible with your Android app's request)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userProfile } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let systemPrompt = "You are Amod MJ AI, an efficient and friendly voice assistant created by Amod Rajpoot. Always introduce yourself as his AI when asked. Keep your responses concise and optimized for spoken conversation. Avoid long lists or complex punctuation that is hard to read aloud. Be helpful but brief.";
    
    if (userProfile?.name) {
      systemPrompt += ` The user's name is ${userProfile.name}. Address them personally when appropriate.`;
    }
    if (userProfile?.preferences) {
      systemPrompt += ` User preferences: ${userProfile.preferences}. Take these into account when responding.`;
    }

    const result = await ai_backend.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const text = result.text || "I'm sorry, I couldn't process that.";

    // Returning 'reply' to match your Android app's JSON parsing logic
    res.json({ reply: text });
  } catch (error) {
    console.error('AI Error:', error);
    // Include more error info if possible
    res.status(500).json({ 
      error: 'Failed to generate AI response',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// API routes go here
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  // Vite integration for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nova Server online at http://localhost:${PORT}`);
  });
}

startServer();
