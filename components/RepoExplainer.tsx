"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const LANGUAGES = [
  { code: "Indonesian", label: "🇮🇩 Indonesia" },
  { code: "Japanese",   label: "🇯🇵 Japanese"  },
  { code: "Spanish",    label: "🇪🇸 Spanish"   },
  { code: "French",     label: "🇫🇷 French"    },
  { code: "German",     label: "🇩🇪 German"    },
  { code: "Chinese",    label: "🇨🇳 Chinese"   },
];

export default function RepoExplainer() {
  const [url, setUrl] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [targetLang, setTargetLang] = useState("Indonesian");
  const [translated, setTranslated] = useState("");
  const [translating, setTranslating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const translateAbortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    if (!url.trim() || loading) return;

    setLoading(true);
    setOutput("");
    setTranslated("");
    setError("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/repo-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setError((await res.text()) || "Failed to analyze repository");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    if (!output || translating) return;

    setTranslating(true);
    setTranslated("");
    translateAbortRef.current = new AbortController();

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: output, targetLang }),
        signal: translateAbortRef.current.signal,
      });

      if (!res.ok) {
        setError("Translation failed. Please try again.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setTranslated((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Translation failed. Please try again.");
      }
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="flex flex-col p-4 sm:p-8 sm:min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="mb-4 sm:mb-7 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">Repo Explainer</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Paste any public GitHub URL to get a comprehensive explanation of the codebase.
        </p>
        <span className="inline-block mt-2 text-xs bg-zinc-800/80 text-zinc-500 px-2.5 py-1 rounded-md">
          meta/llama-3.3-70b-instruct
        </span>
      </div>

      {/* Input row */}
      <div className="flex gap-3 mb-5 shrink-0">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="https://github.com/owner/repo"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
        />
        {loading ? (
          <button
            onClick={() => { abortRef.current?.abort(); setLoading(false); }}
            className="px-5 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleAnalyze}
            disabled={!url.trim()}
            className="px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Analyze
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 mb-4 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Output */}
      {(output || loading) && (
        <div className="min-h-[200px] sm:flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 overflow-y-auto">
          {output ? (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
              {loading && (
                <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-1 rounded-sm align-middle" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-sm">Fetching & analyzing repository…</span>
            </div>
          )}
        </div>
      )}

      {/* Translate section */}
      {output && !loading && (
        <div className="shrink-0 mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={targetLang}
              onChange={(e) => { setTargetLang(e.target.value); setTranslated(""); }}
              disabled={translating}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {translating ? (
              <button
                onClick={() => { translateAbortRef.current?.abort(); setTranslating(false); }}
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleTranslate}
                className="px-4 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium transition-colors"
              >
                {translated ? "Translate again" : "Translate"}
              </button>
            )}
            {translated && !translating && (
              <span className="text-xs text-zinc-600">Translated to {targetLang}</span>
            )}
          </div>

          {/* Translated output */}
          {(translated || translating) && (
            <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6 max-h-80 overflow-y-auto">
              {translated ? (
                <div className="prose-dark">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{translated}</ReactMarkdown>
                  {translating && (
                    <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-1 rounded-sm align-middle" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-zinc-500">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-sm">Translating…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!output && !loading && !error && (
        <div className="py-16 sm:flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">⚡</div>
            <p className="text-zinc-500 text-sm">Enter a GitHub URL above to get started</p>
            <p className="text-zinc-700 text-xs mt-1">Works with any public repository</p>
          </div>
        </div>
      )}
    </div>
  );
}
