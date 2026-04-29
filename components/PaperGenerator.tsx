"use client";

import { useState, useRef, useCallback } from "react";

type Status = "idle" | "fetching_refs" | "generating" | "paused" | "done" | "error";

const LANGUAGES = [
  { label: "English", value: "English" },
  { label: "Indonesian", value: "Indonesian" },
  { label: "Spanish", value: "Spanish" },
  { label: "French", value: "French" },
  { label: "German", value: "German" },
  { label: "Portuguese", value: "Portuguese" },
  { label: "Italian", value: "Italian" },
  { label: "Dutch", value: "Dutch" },
  { label: "Arabic", value: "Arabic" },
  { label: "Chinese (Simplified)", value: "Chinese (Simplified)" },
  { label: "Japanese", value: "Japanese" },
  { label: "Korean", value: "Korean" },
  { label: "Russian", value: "Russian" },
  { label: "Turkish", value: "Turkish" },
];

const PAGE_OPTIONS = [4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30];
const REF_OPTIONS = [5, 8, 10, 15, 20, 25];
const MAX_CHUNK_WORDS = 1300;

// Localized section names for headers in the output
const SECTION_NAMES: Record<string, Record<string, string>> = {
  Indonesian: {
    Abstract: "Abstrak",
    Introduction: "Pendahuluan",
    "Literature Review": "Tinjauan Pustaka",
    Methodology: "Metodologi Penelitian",
    "Results and Discussion": "Hasil dan Pembahasan",
    Conclusion: "Penutup",
    References: "Daftar Pustaka",
  },
  Spanish: {
    Abstract: "Resumen",
    Introduction: "Introducción",
    "Literature Review": "Revisión de Literatura",
    Methodology: "Metodología",
    "Results and Discussion": "Resultados y Discusión",
    Conclusion: "Conclusión",
    References: "Referencias",
  },
  French: {
    Abstract: "Résumé",
    Introduction: "Introduction",
    "Literature Review": "Revue de Littérature",
    Methodology: "Méthodologie",
    "Results and Discussion": "Résultats et Discussion",
    Conclusion: "Conclusion",
    References: "Références",
  },
  German: {
    Abstract: "Zusammenfassung",
    Introduction: "Einleitung",
    "Literature Review": "Literaturüberblick",
    Methodology: "Methodik",
    "Results and Discussion": "Ergebnisse und Diskussion",
    Conclusion: "Fazit",
    References: "Literaturverzeichnis",
  },
  Portuguese: {
    Abstract: "Resumo",
    Introduction: "Introdução",
    "Literature Review": "Revisão de Literatura",
    Methodology: "Metodologia",
    "Results and Discussion": "Resultados e Discussão",
    Conclusion: "Conclusão",
    References: "Referências",
  },
};

function getLocalizedName(sectionName: string, language: string): string {
  return SECTION_NAMES[language]?.[sectionName] ?? sectionName;
}

interface Chunk {
  sectionName: string; // internal English key
  sectionNumber: number;
  chunkIndex: number;
  totalChunks: number;
  wordTarget: number;
}

function buildChunks(pages: number): Chunk[] {
  const totalWords = pages * 500;
  const bodyWords = totalWords - 250;

  const sectionDefs = [
    { name: "Abstract",               number: 0, words: 250 },
    { name: "Introduction",           number: 1, words: Math.round(bodyWords * 0.15) },
    { name: "Literature Review",      number: 2, words: Math.round(bodyWords * 0.27) },
    { name: "Methodology",            number: 3, words: Math.round(bodyWords * 0.20) },
    { name: "Results and Discussion", number: 4, words: Math.round(bodyWords * 0.28) },
    { name: "Conclusion",             number: 5, words: Math.round(bodyWords * 0.10) },
    { name: "References",             number: 6, words: 0 },
  ];

  const chunks: Chunk[] = [];
  for (const sec of sectionDefs) {
    if (sec.words === 0) {
      chunks.push({ sectionName: sec.name, sectionNumber: sec.number, chunkIndex: 0, totalChunks: 1, wordTarget: 0 });
      continue;
    }
    const n = Math.max(1, Math.ceil(sec.words / MAX_CHUNK_WORDS));
    const perChunk = Math.ceil(sec.words / n);
    for (let i = 0; i < n; i++) {
      const wordTarget = i === n - 1 ? sec.words - perChunk * i : perChunk;
      chunks.push({ sectionName: sec.name, sectionNumber: sec.number, chunkIndex: i, totalChunks: n, wordTarget });
    }
  }
  return chunks;
}

function chunkHeader(chunk: Chunk, language: string): string {
  if (chunk.chunkIndex > 0) return "";
  const localName = getLocalizedName(chunk.sectionName, language);
  if (chunk.sectionName === "Abstract") return `## ${localName}\n\n`;
  return `\n\n## ${localName}\n\n`;
}

function progressLabel(chunk: Chunk, language: string): string {
  const localName = getLocalizedName(chunk.sectionName, language);
  const part = chunk.totalChunks > 1 ? ` (${chunk.chunkIndex + 1}/${chunk.totalChunks})` : "";
  return `${localName}${part}`;
}

export default function PaperGenerator() {
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState(8);
  const [numRefs, setNumRefs] = useState(10);
  const [language, setLanguage] = useState("Indonesian");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const [chunkOutputs, setChunkOutputs] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [activeLabel, setActiveLabel] = useState("");

  const [bibliography, setBibliography] = useState<string[]>([]);
  const [citationContext, setCitationContext] = useState("");
  const [chunks, setChunks] = useState<Chunk[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const displayOutput = chunkOutputs.join("") + streamingText;
  const completedCount = chunkOutputs.length;

  const runChunks = useCallback(async (
    fromIdx: number,
    allChunks: Chunk[],
    ctxCitation: string,
    biblio: string[],
    lang: string,
  ) => {
    setStatus("generating");

    for (let i = fromIdx; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      setActiveLabel(progressLabel(chunk, lang));
      setStreamingText("");

      const header = chunkHeader(chunk, lang);

      // References: inject bibliography directly, no AI call
      if (chunk.sectionName === "References") {
        const refLocalName = getLocalizedName("References", lang);
        const refText =
          `\n\n## ${refLocalName}\n\n` +
          (biblio.length > 0 ? biblio.join("\n\n") : "*Tidak ada referensi yang ditemukan.*");
        setChunkOutputs((prev) => [...prev, refText]);
        setStreamingText("");
        continue;
      }

      const abort = new AbortController();
      abortRef.current = abort;

      let chunkText = header;
      setStreamingText(chunkText);

      try {
        const res = await fetch("/api/generate-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "section",
            title,
            language: lang,
            citationContext: ctxCitation,
            sectionName: chunk.sectionName,
            sectionNumber: chunk.sectionNumber,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            wordTarget: chunk.wordTarget,
          }),
          signal: abort.signal,
        });

        if (!res.ok) {
          setError((await res.text()) || "Gagal generate section ini.");
          setStatus("error");
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          if (abort.signal.aborted) {
            setStatus("paused");
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          chunkText += decoder.decode(value, { stream: true });
          setStreamingText(chunkText);
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }

        setChunkOutputs((prev) => [...prev, chunkText]);
        setStreamingText("");
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          setStatus("paused");
          return;
        }
        setError("Terjadi kesalahan jaringan. Klik Continue untuk melanjutkan.");
        setStatus("error");
        return;
      }
    }

    setStatus("done");
    setActiveLabel("");
  }, [title]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setChunkOutputs([]);
    setStreamingText("");
    setError("");
    setStatus("fetching_refs");

    // 1. Fetch refs
    let ctxCitation = "";
    let biblio: string[] = [];
    try {
      const res = await fetch("/api/generate-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "refs", title: title.trim(), numRefs }),
      });
      const data = await res.json();
      biblio = data.bibliography ?? [];
      ctxCitation = data.citationContext ?? "";
    } catch {
      // non-fatal
    }
    setBibliography(biblio);
    setCitationContext(ctxCitation);

    // 2. Build chunks
    const allChunks = buildChunks(pages);
    setChunks(allChunks);

    // 3. Generate
    await runChunks(0, allChunks, ctxCitation, biblio, language);
  }

  async function handleContinue() {
    if (!chunks.length) return;
    await runChunks(completedCount, chunks, citationContext, bibliography, language);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleCopy() {
    navigator.clipboard.writeText(displayOutput);
  }

  function handleDownload() {
    const blob = new Blob([displayOutput], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase() || "paper"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = status === "fetching_refs" || status === "generating";
  const canContinue = (status === "paused" || status === "error") && completedCount < chunks.length;
  const totalChunkCount = chunks.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">✍️</span>
          <h1 className="text-2xl font-bold text-white">Paper Generator</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
            Beta
          </span>
        </div>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Generate full academic papers from a title. APA citation style. References from OpenAlex. Pause and continue anytime.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerate} className="flex flex-col gap-4 mb-8">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Judul Paper</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kebijakan Hukum Terhadap Narkotika Sintetis di Indonesia"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            disabled={isRunning}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Halaman</label>
            <select
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
              disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
            >
              {PAGE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p} halaman (~{(p * 500).toLocaleString()} kata)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Referensi</label>
            <select
              value={numRefs}
              onChange={(e) => setNumRefs(Number(e.target.value))}
              disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
            >
              {REF_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} referensi</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bahasa</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!isRunning && !canContinue && (
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors"
            >
              Generate Paper
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={handleStop}
              className="px-6 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <span className="w-3.5 h-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
              Pause
            </button>
          )}

          {canContinue && (
            <>
              <button
                type="button"
                onClick={handleContinue}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                Continue ({completedCount}/{totalChunkCount})
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium transition-colors"
              >
                Mulai ulang
              </button>
            </>
          )}

          {status === "fetching_refs" && (
            <p className="text-xs text-zinc-500 animate-pulse">Mengambil referensi dari OpenAlex…</p>
          )}
          {status === "generating" && activeLabel && (
            <p className="text-xs text-zinc-500 animate-pulse">
              Menulis: <span className="text-zinc-400">{activeLabel}</span>
              {totalChunkCount > 0 && <span className="text-zinc-600"> — {completedCount}/{totalChunkCount}</span>}
            </p>
          )}
          {status === "paused" && (
            <p className="text-xs text-amber-500">Dijeda. Klik Continue untuk melanjutkan.</p>
          )}
          {status === "done" && (
            <p className="text-xs text-green-500">
              Selesai — {Math.round(displayOutput.split(/\s+/).length).toLocaleString()} kata.
            </p>
          )}
        </div>
      </form>

      {/* Error */}
      {status === "error" && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6 flex items-center justify-between gap-3">
          <span>{error}</span>
          {canContinue && (
            <button
              onClick={handleContinue}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      )}

      {/* Output */}
      {displayOutput && (
        <div className="flex flex-col gap-3">
          {(status === "done" || status === "paused") && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-600">
                ~{Math.round(displayOutput.split(/\s+/).length).toLocaleString()} kata
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20 transition-colors"
                >
                  Download .md
                </button>
              </div>
            </div>
          )}

          <div
            ref={outputRef}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono"
          >
            {displayOutput}
            {isRunning && (
              <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>
      )}

      {status === "idle" && !displayOutput && (
        <div className="text-center py-16 text-zinc-700">
          <p className="text-5xl mb-4">📝</p>
          <p className="text-sm">Masukkan judul dan klik Generate.</p>
          <p className="text-xs mt-2 text-zinc-700">
            Sitasi APA · Referensi dari OpenAlex · Bisa pause & continue
          </p>
        </div>
      )}
    </div>
  );
}
