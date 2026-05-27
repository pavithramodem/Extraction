import React, { useState } from "react";
import axios from "axios";
import Tesseract from "tesseract.js";
import "./tessaract.css";
import { extractFromPDF } from "../Helpers/helpers";

function Retrieval() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("invoke");

  const extractText = async () => {
    if (!file) return;
    setLoading(true);
    setStatus("Extracting text...");
    try {
      let extractedText = "";
      if (file.type === "application/pdf") {
        extractedText = await extractFromPDF(file);
      } else {
        const result = await Tesseract.recognize(file, "eng");
        if (!result || !result.data) throw new Error("OCR failed");
        extractedText = result.data.text;
      }
      setText(extractedText);
      setStatus("Text extracted successfully!");
    } catch (err) {
      console.error(err);
      setText("Failed to extract text.");
      setStatus("Extraction failed.");
    }
    setLoading(false);
  };

  const askQuestion = async () => {
    if (!question || !text) {
      setAnswer("Please extract text from a document first.");
      return;
    }
    setLoading(true);
    setStatus(mode === "invoke" ? "Invoking AI..." : "Streaming response...");
    try {
      const response = await axios.post("http://localhost:5000/ask", {
        context: text,
        question,
      });
      const fullAnswer = response.data.answer;
      if (mode === "invoke") {
        setAnswer(fullAnswer);
      } else {
        setAnswer("");
        let streamedText = "";
        for (let i = 0; i < fullAnswer.length; i++) {
          streamedText += fullAnswer[i];
          setAnswer(streamedText);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      setStatus("");
    } catch (err) {
      console.error(err);
      setAnswer("Could not connect to server.");
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <div className="app-shell">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="topbar-icon" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Document Q&amp;A
          </div>

          {/* Mode Toggle — top right */}
          <div className="mode-pills">
            <button
              className={`pill ${mode === "invoke" ? "active" : ""}`}
              onClick={() => setMode("invoke")}
            >
              Invoke
            </button>
            <button
              className={`pill ${mode === "stream" ? "active" : ""}`}
              onClick={() => setMode("stream")}
            >
              Stream
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="main">
          {/* Upload Zone */}
          <div
            className={`upload-zone ${file ? "has-file" : ""}`}
            onClick={() => document.getElementById("fileInput").click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                setFile(e.target.files[0]);
                setText("");
                setAnswer("");
                setStatus("");
              }}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon" aria-hidden="true">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            {file ? (
              <>
                <span className="upload-filename">{file.name}</span>
                <span className="upload-sublabel">Click to change file</span>
              </>
            ) : (
              <>
                <span className="upload-label">Drop a file or click to browse</span>
                <span className="upload-sublabel">Supports PDF and images</span>
              </>
            )}
          </div>

          {/* Extract Button + Status */}
          {file && (
            <div className="extract-row">
              <button
                className="extract-btn"
                onClick={extractText}
                disabled={loading}
              >
                {loading && !answer ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
                    </svg>
                    Extract Text
                  </>
                )}
              </button>
              {status && <span className="status-chip">{status}</span>}
            </div>
          )}

          {/* Extracted Text */}
          {text && (
            <div className="extracted-box">
              <div className="section-label">Extracted text</div>
              <textarea className="extracted-textarea" value={text} readOnly />
            </div>
          )}

          {/* Question Input */}
          <div className={`question-row ${!text ? "disabled" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="question-icon" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <input
              className="question-input"
              placeholder="Ask a question about the document..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askQuestion()}
              disabled={!text}
            />
            <button
              className="ask-btn"
              onClick={askQuestion}
              disabled={loading || !text || !question}
            >
              {loading ? (
                <><span className="spinner white" aria-hidden="true" /> Thinking...</>
              ) : (
                <>
                  Ask
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Answer */}
          {answer && (
            <div className="answer-card">
              <div className="answer-header">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Answer
              </div>
              <p className="answer-text">{answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Retrieval;