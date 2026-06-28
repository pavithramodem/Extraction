const express = require("express");
const cors    = require("cors");
const axios   = require("axios");
require("dotenv").config();

console.log("GRK loaded:", !!process.env.GRK_API_KEY);
console.log("OPENROUTER loaded:", !!process.env.OPENROUTER_API_KEY);
console.log("GEMINI loaded:", !!process.env.GEMINI_API_KEY);
console.log("DEEPSEEK loaded:", !!process.env.DEEPSEEK_API_KEY);

const { classifyWithGroq } = require("./helper");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── API Keys ──────────────────────────────────────────────────────────────
const GROQ_API_KEY       = process.env.GRK_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY   = process.env.DEEPSEEK_API_KEY;

// ── Helper: detect quota/balance errors ───────────────────────────────────
function isQuotaError(err) {
  const status  = err.response?.status;
  const message = (
    err.response?.data?.error?.message ||
    err.message ||
    ""
  ).toLowerCase();

  return (
    status === 402 ||
    status === 429 ||
    message.includes("insufficient balance") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("exceeded") ||
    message.includes("billing") ||
    message.includes("limit reached")
  );
}


// ==========================================
// GROQ — classifier + silent fallback
// ==========================================
async function callGroq(systemPrompt, userPrompt, temperature = 0.1) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.choices[0].message.content;
}

// Groq acting as fallback for any model
async function callGroqFallback(context, question, role = "general") {
  const systemPrompts = {
    general:
      "You are a knowledgeable research assistant. Answer the user's question using the provided document context. Be thorough, well-structured, and insightful.",
    code:
      "You are an expert software engineer and mathematician. For code questions: pinpoint bugs, explain errors clearly, and suggest precise fixes with code examples. For math questions: solve step by step and show all working clearly.",
    vision:
      "You are an expert at analysing documents and content. Answer the user's question with detailed observations about the content provided.",
  };

  return await callGroq(
    systemPrompts[role] || systemPrompts.general,
    `Document context:\n\n${context}\n\nQuestion: ${question}`,
    0.5
  );
}


// ==========================================
// OPENROUTER — explanations / research / ideas
// Fallback → Groq if quota hit
// ==========================================
async function callOpenRouter(context, question) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        messages: [
          {
            role: "system",
            content:
              "You are a knowledgeable research assistant. Answer the user's question using the provided document context. Be thorough, well-structured, and insightful.",
          },
          {
            role: "user",
            content: `Document context:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title":      "Document QA App",
        },
      }
    );
    return { answer: response.data.choices[0].message.content, usedFallback: false };

  } catch (err) {
    if (isQuotaError(err)) {
      // ── Quota hit → silently fallback to Groq ──────────────────────────
      console.warn("⚠️  OpenRouter quota hit — falling back to Groq (intent: gpt, type unchanged)");
      const answer = await callGroqFallback(context, question, "general");
      return { answer, usedFallback: true };
    }
    throw err; // re-throw non-quota errors
  }
}


// ==========================================
// GEMINI — vision / PDF / image understanding
// Fallback → Groq if quota hit
// ==========================================
async function callGemini(context, question, imageBase64 = null, imageMime = "image/png") {
  try {
    const parts = [];

    if (imageBase64) {
      parts.push({
        inline_data: { mime_type: imageMime, data: imageBase64 },
      });
    }

    parts.push({
      text: imageBase64
        ? `Question about the image: ${question}`
        : `Document context:\n\n${context}\n\nQuestion: ${question}`,
    });

    const response = await axios.post(
     `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts }],
        systemInstruction: {
          parts: [{
            text: "You are an expert at analysing documents, images, charts, and visual content. Answer the user's question with detailed observations about the content provided.",
          }],
        },
      },
      { headers: { "Content-Type": "application/json" } }
    );

    return { answer: response.data.candidates[0].content.parts[0].text, usedFallback: false };

  } catch (err) {
    if (isQuotaError(err)) {
      // ── Quota hit → silently fallback to Groq ──────────────────────────
      console.warn("⚠️  Gemini quota hit — falling back to Groq (intent: gemini, type unchanged)");
      const answer = await callGroqFallback(context, question, "vision");
      return { answer, usedFallback: true };
    }
    throw err;
  }
}


// ==========================================
// DEEPSEEK — math / code debugging / algorithms
// Fallback → Groq if quota hit
// ==========================================
async function callDeepSeek(context, question) {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are an expert software engineer and mathematician. For code questions: pinpoint bugs, explain errors clearly, and suggest precise fixes with code examples. For math questions: solve step by step and show all working clearly.",
          },
          {
            role: "user",
            content: `Document context:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return { answer: response.data.choices[0].message.content, usedFallback: false };

  } catch (err) {
    if (isQuotaError(err)) {
      // ── Quota hit → silently fallback to Groq ──────────────────────────
      console.warn("⚠️  DeepSeek quota hit — falling back to Groq (intent: deepseek, type unchanged)");
      const answer = await callGroqFallback(context, question, "code");
      return { answer, usedFallback: true };
    }
    throw err;
  }
}


// ==========================================
// ROOT
// ==========================================
app.get("/", (_req, res) => res.send("Server running"));


// ==========================================
// MAIN ASK ROUTE
// ==========================================
app.post("/ask", async (req, res) => {
  try {
    const {
      context,
      question,
      imageBase64 = null,
      imageMime   = "image/png",
    } = req.body;

    if (!context || !question) {
      return res.status(400).json({ answer: "Missing context or question." });
    }

    console.log("\n── Incoming question ──────────────────────────────");
    console.log("Q:", question);

    // Step 1: Groq classifies the question
    // Intent and type are ALWAYS set by Groq — never changed by fallback
    const { model, type, question: refinedQuestion } = await classifyWithGroq(
      context,
      question,
      !!imageBase64,
      callGroq
    );

    console.log(`Groq routed → ${model.toUpperCase()} (type: ${type})`);
    console.log("Refined Q  →", refinedQuestion);

    // Step 2: Call the right model — fallback to Groq if quota hit
    // NOTE: model and type in the response NEVER change even if Groq answers
    let answer, usedFallback;

    switch (model) {
      case "gemini":
        ({ answer, usedFallback } = await callGemini(context, refinedQuestion, imageBase64, imageMime));
        break;
      case "deepseek":
        ({ answer, usedFallback } = await callDeepSeek(context, refinedQuestion));
        break;
      case "gpt":
      default:
        ({ answer, usedFallback } = await callOpenRouter(context, refinedQuestion));
        break;
    }

    if (usedFallback) {
      console.log(`✅ Groq answered as fallback — intent: ${model}, type: ${type} (unchanged)`);
    } else {
      console.log(`✅ Answer received from ${model.toUpperCase()}`);
    }

    // model and type are always the ORIGINAL Groq classification
    // usedFallback tells client Groq stepped in — but intent is preserved
    return res.json({
      answer,
      model,            // always original: "gpt" | "gemini" | "deepseek"
      type,             // always original: "math" | "vision" | "explanation" etc.
      refinedQuestion,
      usedFallback,     // true if Groq answered instead
    });

  } catch (err) {
    console.log("FULL ERROR:", JSON.stringify(err.response?.data, null, 2));
    console.log("STATUS:", err.response?.status);
    const msg =
      err.response?.data?.error?.message ||
      err.message ||
      "Something went wrong.";
    console.error("Server error:", msg);
    return res.status(500).json({ answer: `Error: ${msg}` });
  }
});


// ==========================================
// START
// ==========================================
app.listen(5000, () => console.log("Server running on http://localhost:5000"));