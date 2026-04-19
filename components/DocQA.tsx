"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DocInfo {
  text: string;
  pages: number;
  fileName: string;
  truncated: boolean;
}

export default function DocQA() {
  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
      return;
    }

    setUploading(true);
    setError("");
    setMessages([]);
    setDocInfo(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to process PDF");
        return;
      }
      setDocInfo(data);
    } catch {
      setError("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: "user", content: question.trim() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setQuestion("");
    setLoading(true);
    setError("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/doc-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMsg.content,
          context: docInfo?.text ?? "",
          history: messages,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1));
        setError("Failed to get a response. Please try again.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.slice(0, -1));
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function resetDoc() {
    setDocInfo(null);
    setMessages([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-5 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">Doc Q&A</h2>
        <p className="text-zinc-500 mt-1 text-sm">Upload a PDF and ask anything about it.</p>
        <span className="inline-block mt-2 text-xs bg-zinc-800/80 text-zinc-500 px-2.5 py-1 rounded-md">
          meta/llama-3.1-70b-instruct
        </span>
      </div>

      {!docInfo ? (
        /* Upload area */
        <div className="flex-1 flex items-center justify-center">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            onDragOver={(e) => e.preventDefault()}
            className="w-full max-w-sm border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-2xl p-12 text-center cursor-pointer transition-colors group"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Processing PDF…</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📄</div>
                <p className="text-zinc-300 font-medium mb-1">Drop your PDF here</p>
                <p className="text-zinc-600 text-sm">or click to browse</p>
                {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                <p className="text-zinc-700 text-xs mt-3">PDF only · Max ~4 MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
          />
        </div>
      ) : (
        <>
          {/* Doc info bar */}
          <div className="shrink-0 flex items-center justify-between mb-4 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-lg">📄</span>
              <div>
                <p className="text-sm font-medium text-zinc-200 leading-none mb-0.5">{docInfo.fileName}</p>
                <p className="text-xs text-zinc-500">
                  {docInfo.pages} page{docInfo.pages !== 1 ? "s" : ""}
                  {docInfo.truncated && " · Truncated to 50k chars"}
                </p>
              </div>
            </div>
            <button
              onClick={resetDoc}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Change file
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 min-h-0 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-zinc-600 text-sm">Document ready — ask anything about it</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose-dark text-sm">
                      {msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        <div className="flex gap-1 py-1">
                          {[0, 150, 300].map((d) => (
                            <span
                              key={d}
                              className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${d}ms` }}
                            />
                          ))}
                        </div>
                      )}
                      {loading && i === messages.length - 1 && msg.content && (
                        <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse ml-0.5 rounded-sm align-middle" />
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0">
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask a question about the document…"
                disabled={loading}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors text-sm disabled:opacity-50"
              />
              <button
                onClick={loading ? () => { abortRef.current?.abort(); setLoading(false); } : handleSend}
                disabled={!loading && !question.trim()}
                className={`px-5 py-3 rounded-lg text-white text-sm font-medium transition-colors whitespace-nowrap ${
                  loading
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {loading ? "Stop" : "Send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
