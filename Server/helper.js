// ==========================================
// FIND RELEVANT TEXT
// ==========================================

function findRelevantText(context, question) {
  if (!context) return "";

  const sentences = context
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => sentence.trim().length > 10);

  const words = question
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);

  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    words.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score++;
    });
    return { sentence, score };
  });

  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.sentence)
    .join(" ");

  return topSentences || context;
}


// ==========================================
// DETECT GENERAL QUESTIONS
// ==========================================

function isGeneralQuestion(question) {
  const normalized = question.toLowerCase().replace(/[?!.,]/g, "").trim();

  const patterns = [
    // summarize / summary
    "summarize",
    "summary",
    "give me a summary",
    "give summary",
    "brief summary",
    "short summary",

    // what is this about
    "what is this",
    "what is this document",
    "what is this document about",
    "what is this about",
    "what is the document about",
    "what does this document",
    "what does this document talk about",
    "what does this talk about",
    "what is this file about",
    "what's this about",
    "what's this document about",
    "whats this about",
    "whats this document about",

    // overview / main idea
    "overview",
    "main idea",
    "main topic",
    "main point",
    "key points",
    "key ideas",

    // describe / explain
    "describe this document",
    "describe this",
    "explain this document",
    "explain this",
    "tell me about this document",
    "tell me about this",
    "what can you tell me about this",

    // topic / subject
    "what topic",
    "what subject",
    "what is the topic",
    "what is the subject",
  ];

  return patterns.some(pattern => normalized.includes(pattern));
}


module.exports = { findRelevantText, isGeneralQuestion };