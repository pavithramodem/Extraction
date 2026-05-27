const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const { findRelevantText, isGeneralQuestion } = require("./helper");

const app = express();

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;
const GROQ_API_KEY = process.env.GRK_API_KEY;


// ==========================================
// CALL GROQ
// ==========================================

async function callGroq(systemPrompt, userPrompt, temperature = 0.5) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
        model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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


// ==========================================
// HANDLE GENERAL QUESTION
// ==========================================

async function handleGeneralQuestion(context, question) {
  console.log("→ Routing to GROQ (general question)");

  return await callGroq(
    "You are a helpful AI document assistant. When asked to summarize or describe a document, give a clear, well-structured answer covering the main topics, purpose, and key points.",
    `Here is the document content:\n\n${context}\n\nUser question: ${question}`,
    0.5
  );
}


// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.send("Server is running");
});


// ==========================================
// MAIN ASK ROUTE
// ==========================================

app.post("/ask", async (req, res) => {
  try {
    const { context, question } = req.body;

    if (!context || !question) {
      return res.json({ answer: "Missing context or question." });
    }

    console.log("Question received:", question);
    console.log("isGeneralQuestion:", isGeneralQuestion(question));

    // ── General question → Groq ─────────────
    if (isGeneralQuestion(question)) {
      const answer = await handleGeneralQuestion(context, question);
      return res.json({ answer });
    }

    // ── Specific QA → HuggingFace ───────────
    console.log("→ Routing to HuggingFace (specific question)");

    const relevantText = findRelevantText(context, question);

    let hfAnswer = null;
    let hfScore = 0;

    try {
      const hfResponse = await axios.post(
        "https://router.huggingface.co/hf-inference/models/deepset/roberta-base-squad2",
        { inputs: { question, context: relevantText } },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("HF RAW:", hfResponse.data);

      hfAnswer = hfResponse.data?.answer?.trim();
      hfScore = hfResponse.data?.score || 0;

    } catch (hfErr) {
      console.warn("HuggingFace call failed:", hfErr.response?.data || hfErr.message);
    }

    // ── Groq fallback if HF answer is weak ──
    if (!hfAnswer || hfScore < 0.1) {
      console.log("→ HF weak/failed — falling back to GROQ");

      const answer = await callGroq(
        "You are a helpful document assistant. Answer the user's question using only the provided document content. Be concise and accurate.",
        `Document:\n\n${context}\n\nQuestion: ${question}`,
        0.3
      );

      return res.json({ answer });
    }

    // ── Return HF answer ─────────────────────
    console.log(`→ HF answer accepted (score: ${hfScore.toFixed(3)})`);
    return res.json({ answer: hfAnswer });

  } catch (err) {
    console.error("Server error:", err.response?.data || err.message);

    return res.json({
      answer: `Error: ${err.response?.data?.error?.message || err.message || "Something went wrong. Please try again."}`,
    });
  }
});


// ==========================================
// START SERVER
// ==========================================

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});