// ==========================================
// GROQ CLASSIFIER
// ==========================================
// Returns: { model: "gpt"|"gemini"|"deepseek", type: string, question: string }
//
// Routing rules:
//   gpt       → explanations, reasoning, summaries, research, general knowledge
//   gemini    → vision, image understanding, PDF visual analysis, charts
//   deepseek  → math, algorithms, code debugging, fixing errors, stack traces

async function classifyWithGroq(context, question, hasImage = false, callGroq) {
  // If an image is attached, always route to Gemini
  if (hasImage) {
    return { model: "gemini", type: "vision", question };
  }

  const systemPrompt = `You are an AI question router. Analyse the user's question and decide which model should answer it.

ROUTING RULES — pick exactly one:
- "gpt"      → general explanations, summaries, reasoning, research, brainstorming, concepts, history, comparisons, general knowledge
- "gemini"   → questions about IMAGES, visual content, charts, diagrams, or PDF layout/structure
- "deepseek" → CODE debugging, code review, fixing errors, stack traces, refactoring, MATH problems, algorithms, numerical computation, data structures, coding puzzles

Also provide a short "type" label (e.g. "summary", "debugging", "math", "vision", "explanation").

Respond ONLY with valid JSON. No markdown. No extra text.
Format: {"model": "gpt", "type": "summary", "question": "<refined self-contained question>"}`;

  const userPrompt = `Document context (first 600 chars): ${context.slice(0, 600)}

User question: ${question}

Respond with JSON only.`;

  const raw = await callGroq(systemPrompt, userPrompt, 0.1);

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const validModels = ["gpt", "gemini", "deepseek"];
    if (!validModels.includes(parsed.model)) throw new Error("Invalid model: " + parsed.model);
    if (!parsed.question || typeof parsed.question !== "string") throw new Error("Missing question");

    return {
      model:    parsed.model,
      type:     parsed.type || "general",
      question: parsed.question,
    };
  } catch (err) {
    console.warn("Groq classifier parse failed, defaulting to gpt:", err.message);
    return { model: "gpt", type: "general", question };
  }
}

module.exports = { classifyWithGroq };