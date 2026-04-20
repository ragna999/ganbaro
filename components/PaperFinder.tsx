"use client";

import { useState, useRef } from "react";
import type { Paper } from "@/app/api/paper-search/route";

type ExplainState = "idle" | "loading" | "streaming" | "done" | "error";

interface PaperCardProps {
  paper: Paper;
}

function PaperCard({ paper }: PaperCardProps) {
  const [explainState, setExplainState] = useState<ExplainState>("idle");
  const [explanation, setExplanation] = useState("");
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doi = paper.externalIds?.DOI;
  const arxiv = paper.externalIds?.ArXiv;
  const pdfUrl = paper.openAccessPdf?.url;

  async function handleExplain() {
    if (explainState === "streaming" || explainState === "loading") {
      abortRef.current?.abort();
      setExplainState("idle");
      return;
    }

    setExplanation("");
    setExplainState("loading");
    setExpanded(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/paper-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          year: paper.year,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setExplanation(msg || "Failed to explain this paper.");
        setExplainState("error");
        return;
      }

      setExplainState("streaming");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExplanation((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setExplainState("done");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setExplainState("idle");
      } else {
        setExplanation("Something went wrong. Please try again.");
        setExplainState("error");
      }
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug line-clamp-2">
            {paper.title}
          </h3>
          {paper.authors.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {paper.authors.slice(0, 3).map((a) => a.name).join(", ")}
              {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {paper.year && (
            <span className="text-xs font-medium text-zinc-400">{paper.year}</span>
          )}
          {paper.citationCount > 0 && (
            <span className="text-xs text-zinc-600">
              {paper.citationCount.toLocaleString()} citations
            </span>
          )}
        </div>
      </div>

      {/* Fields */}
      {paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {paper.fieldsOfStudy.slice(0, 3).map((f) => (
            <span
              key={f}
              className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <div>
          <p className={`text-xs text-zinc-500 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
            {paper.abstract}
          </p>
          {paper.abstract.length > 200 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {!paper.abstract && (
        <p className="text-xs text-zinc-600 italic">No abstract available.</p>
      )}

      {/* AI Explanation */}
      {(explainState !== "idle" || explanation) && (
        <div className="border-t border-zinc-800 pt-3">
          {explainState === "loading" && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              Generating explanation…
            </div>
          )}
          {(explainState === "streaming" || explainState === "done" || explainState === "error") && explanation && (
            <div className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {explanation}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        <button
          onClick={handleExplain}
          disabled={!paper.abstract}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            !paper.abstract
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              : explainState === "loading" || explainState === "streaming"
              ? "bg-violet-600/20 text-violet-300 hover:bg-red-500/10 hover:text-red-400"
              : explainState === "done"
              ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              : "bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 border border-violet-500/20"
          }`}
        >
          {explainState === "loading" || explainState === "streaming" ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Stop
            </>
          ) : explainState === "done" ? (
            "Re-explain with AI"
          ) : (
            <>✨ Explain with AI</>
          )}
        </button>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            Open PDF
          </a>
        )}

        {doi && (
          <a
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            DOI ↗
          </a>
        )}

        {arxiv && (
          <a
            href={`https://arxiv.org/abs/${arxiv}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            arXiv ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function PaperFinder() {
  const [query, setQuery] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [limit, setLimit] = useState("10");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setStatus("loading");
    setError("");
    setPapers([]);
    setTotal(null);

    const params = new URLSearchParams({ q: query.trim(), limit });
    if (yearFrom) params.set("yearFrom", yearFrom);
    if (yearTo) params.set("yearTo", yearTo);

    try {
      const res = await fetch(`/api/paper-search?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Search failed. Please try again.");
        setStatus("error");
        return;
      }

      setPapers(data.papers ?? []);
      setTotal(data.total ?? 0);
      setStatus("done");
    } catch {
      setError("Network error. Please check your connection.");
      setStatus("error");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔬</span>
            <h1 className="text-2xl font-bold text-white">Paper Finder</h1>
          </div>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Search millions of academic papers via Semantic Scholar. Get AI-powered explanations of any paper.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. transformer attention mechanism, CRISPR gene editing…"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              disabled={status === "loading" || !query.trim()}
              className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors shrink-0"
            >
              {status === "loading" ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin block" />
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="Year from"
              min="1900"
              max={new Date().getFullYear()}
              className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="Year to"
              min="1900"
              max={new Date().getFullYear()}
              className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="5">5 results</option>
              <option value="10">10 results</option>
              <option value="20">20 results</option>
            </select>
          </div>
        </form>

        {/* Error */}
        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {status === "done" && (
          <>
            {papers.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <p className="text-4xl mb-3">🔭</p>
                <p className="text-sm">No papers found. Try different keywords.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-600 mb-4">
                  Showing {papers.length} of {total?.toLocaleString() ?? "?"} results for{" "}
                  <span className="text-zinc-400">"{query}"</span>
                </p>
                <div className="flex flex-col gap-4">
                  {papers.map((paper) => (
                    <PaperCard key={paper.paperId} paper={paper} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {status === "idle" && (
          <div className="text-center py-16 text-zinc-700">
            <p className="text-5xl mb-4">📚</p>
            <p className="text-sm">Search for any academic topic to get started.</p>
            <p className="text-xs mt-2 text-zinc-700">Powered by Semantic Scholar — 200M+ papers indexed</p>
          </div>
        )}
      </div>
    </div>
  );
}
