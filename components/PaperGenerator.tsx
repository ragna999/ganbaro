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

const SECTION_NAMES: Record<string, Record<string, string>> = {
  Indonesian: {
    Abstract: "Abstrak",
    Introduction: "Pendahuluan",
    Methodology: "Metodologi Penelitian",
    "Results and Discussion": "Hasil dan Pembahasan",
    Conclusion: "Penutup",
    References: "Daftar Pustaka",
  },
  Spanish: {
    Abstract: "Resumen",
    Introduction: "Introducción",
    Methodology: "Metodología",
    "Results and Discussion": "Resultados y Discusión",
    Conclusion: "Conclusión",
    References: "Referencias",
  },
  French: {
    Abstract: "Résumé",
    Introduction: "Introduction",
    Methodology: "Méthodologie",
    "Results and Discussion": "Résultats et Discussion",
    Conclusion: "Conclusion",
    References: "Références",
  },
  German: {
    Abstract: "Zusammenfassung",
    Introduction: "Einleitung",
    Methodology: "Methodik",
    "Results and Discussion": "Ergebnisse und Diskussion",
    Conclusion: "Fazit",
    References: "Literaturverzeichnis",
  },
  Portuguese: {
    Abstract: "Resumo",
    Introduction: "Introdução",
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
  sectionName: string;
  sectionNumber: number;
  chunkIndex: number;
  totalChunks: number;
  wordTarget: number;
}

interface UploadedLaw {
  id: string;
  name: string;
  text: string;
  pages: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

function buildChunks(pages: number): Chunk[] {
  const totalWords = pages * 500;
  const bodyWords = totalWords - 250;

  // Literature Review removed — Introduction expanded to cover theory/framework
  const sectionDefs = [
    { name: "Abstract",               number: 0, words: 500 },
    { name: "Introduction",           number: 1, words: Math.round(bodyWords * 0.25) },
    { name: "Methodology",            number: 2, words: Math.round(bodyWords * 0.20) },
    { name: "Results and Discussion", number: 3, words: Math.round(bodyWords * 0.40) },
    { name: "Conclusion",             number: 4, words: Math.round(bodyWords * 0.15) },
    { name: "References",             number: 5, words: 0 },
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
  const [title, setTitle]       = useState("");
  const [pages, setPages]       = useState(8);
  const [numRefs, setNumRefs]   = useState(10);
  const [language, setLanguage] = useState("Indonesian");

  // Law inputs
  const [lawInput, setLawInput] = useState("");
  const [laws, setLaws]         = useState<string[]>([]);
  const [lawStatuses, setLawStatuses] = useState<Record<string, "ok" | "not_found">>({});
  const [uploadedLaws, setUploadedLaws] = useState<UploadedLaw[]>([]);

  const [status, setStatus]           = useState<Status>("idle");
  const [error, setError]             = useState("");
  const [chunkOutputs, setChunkOutputs] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [activeLabel, setActiveLabel] = useState("");

  const [bibliography, setBibliography]   = useState<string[]>([]);
  const [citationContext, setCitationContext] = useState("");
  const [lawContext, setLawContext]       = useState("");
  const [chunks, setChunks]             = useState<Chunk[]>([]);

  const abortRef     = useRef<AbortController | null>(null);
  const outputRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayOutput  = chunkOutputs.join("") + streamingText;
  const completedCount = chunkOutputs.length;

  function addLaw() {
    const trimmed = lawInput.trim();
    if (!trimmed || laws.includes(trimmed)) return;
    setLaws((prev) => [...prev, trimmed]);
    setLawInput("");
  }

  function removeLaw(law: string) {
    setLaws((prev) => prev.filter((l) => l !== law));
    setLawStatuses((prev) => { const next = { ...prev }; delete next[law]; return next; });
  }

  function removeUploadedLaw(id: string) {
    setUploadedLaws((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleFileUpload(file: File) {
    const id = `${Date.now()}-${Math.random()}`;
    const name = file.name.replace(/\.pdf$/i, "");
    setUploadedLaws((prev) => [...prev, { id, name, text: "", pages: 0, status: "uploading" }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal ekstrak PDF");
      setUploadedLaws((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, text: (data.text as string).slice(0, 6000), pages: data.pages as number, status: "done" } : l
        )
      );
    } catch (e) {
      setUploadedLaws((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status: "error", error: e instanceof Error ? e.message : "Gagal ekstrak" } : l
        )
      );
    }
  }

  const runChunks = useCallback(async (
    fromIdx: number,
    allChunks: Chunk[],
    ctxCitation: string,
    ctxLaw: string,
    biblio: string[],
    lang: string,
  ) => {
    setStatus("generating");

    for (let i = fromIdx; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      setActiveLabel(progressLabel(chunk, lang));
      setStreamingText("");

      const header = chunkHeader(chunk, lang);

      // References: inject directly, no AI
      if (chunk.sectionName === "References") {
        const localName = getLocalizedName("References", lang);
        const refText =
          `\n\n## ${localName}\n\n` +
          (biblio.length > 0 ? biblio.join("\n\n") : "*Tidak ada referensi yang ditemukan.*");
        setChunkOutputs((prev) => [...prev, refText]);
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
            lawContext: ctxLaw,
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
          if (abort.signal.aborted) { setStatus("paused"); return; }
          const { done, value } = await reader.read();
          if (done) break;
          chunkText += decoder.decode(value, { stream: true });
          setStreamingText(chunkText);
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }

        setChunkOutputs((prev) => [...prev, chunkText]);
        setStreamingText("");
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") { setStatus("paused"); return; }
        setError("Terjadi kesalahan. Klik Continue untuk melanjutkan.");
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

    // 1. Fetch OpenAlex refs + Wikisource law texts in parallel
    let ctxCitation = "";
    let biblio: string[] = [];
    let ctxLaw = "";

    const [refsRes, lawsRes] = await Promise.allSettled([
      fetch("/api/generate-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "refs", title: title.trim(), numRefs }),
      }).then((r) => r.json()),
      laws.length > 0
        ? fetch("/api/generate-paper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "laws", laws }),
          }).then((r) => r.json())
        : Promise.resolve(null),
    ]);

    if (refsRes.status === "fulfilled") {
      biblio = refsRes.value.bibliography ?? [];
      ctxCitation = refsRes.value.citationContext ?? "";
    }

    if (lawsRes.status === "fulfilled" && lawsRes.value) {
      ctxLaw = lawsRes.value.lawContext ?? "";
      // Update law status indicators
      const statuses: Record<string, "ok" | "not_found"> = {};
      laws.forEach((l) => { statuses[l] = (lawsRes.value.notFound ?? []).includes(l) ? "not_found" : "ok"; });
      setLawStatuses(statuses);
    }

    // Combine Wikisource law context with uploaded PDFs
    const uploadedCtx = uploadedLaws
      .filter((l) => l.status === "done")
      .map((l) => `=== ${l.name} (uploaded) ===\n${l.text}`)
      .join("\n\n");
    if (uploadedCtx) ctxLaw = [ctxLaw, uploadedCtx].filter(Boolean).join("\n\n");

    setBibliography(biblio);
    setCitationContext(ctxCitation);
    setLawContext(ctxLaw);

    const allChunks = buildChunks(pages);
    setChunks(allChunks);

    await runChunks(0, allChunks, ctxCitation, ctxLaw, biblio, language);
  }

  async function handleContinue() {
    if (!chunks.length) return;
    await runChunks(completedCount, chunks, citationContext, lawContext, bibliography, language);
  }

  function handleStop() { abortRef.current?.abort(); }
  function handleCopy() { navigator.clipboard.writeText(displayOutput); }
  function handleDownload() {
    const blob = new Blob([displayOutput], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase() || "paper"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning     = status === "fetching_refs" || status === "generating";
  const canContinue   = (status === "paused" || status === "error") && completedCount < chunks.length;
  const totalChunkCount = chunks.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">✍️</span>
          <h1 className="text-2xl font-bold text-white">Paper Generator</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">Beta</span>
        </div>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Generate full academic papers from a title. APA citations from OpenAlex. Indonesian laws fetched from Wikisource. Pause and continue anytime.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerate} className="flex flex-col gap-4 mb-8">

        {/* Title */}
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

        {/* Options row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Halaman</label>
            <select value={pages} onChange={(e) => setPages(Number(e.target.value))} disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors">
              {PAGE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p} halaman (~{(p * 500).toLocaleString()} kata)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Referensi Jurnal</label>
            <select value={numRefs} onChange={(e) => setNumRefs(Number(e.target.value))} disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors">
              {REF_OPTIONS.map((r) => (<option key={r} value={r}>{r} referensi</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bahasa</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors">
              {LANGUAGES.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
            </select>
          </div>
        </div>

        {/* Law input */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Undang-Undang / Peraturan
            <span className="ml-1.5 text-zinc-600 font-normal normal-case">— opsional</span>
          </label>

          {/* Wikisource row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={lawInput}
              onChange={(e) => setLawInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLaw(); } }}
              placeholder="e.g. UU No. 35 Tahun 2009 (dari Wikisource)"
              disabled={isRunning}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="button"
              onClick={addLaw}
              disabled={!lawInput.trim() || isRunning}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm font-medium transition-colors shrink-0"
            >
              + Tambah
            </button>
          </div>

          {/* PDF upload row */}
          <div className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { handleFileUpload(file); e.target.value = ""; }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/5 disabled:opacity-40 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors w-full justify-center"
            >
              <span>↑</span> Upload PDF UU / Peraturan
            </button>
          </div>

          {/* Wikisource law list */}
          {laws.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {laws.map((law) => (
                <div key={law} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-zinc-500 shrink-0">Wikisource</span>
                  <span className="text-xs text-zinc-300 flex-1">{law}</span>
                  {lawStatuses[law] === "ok" && <span className="text-xs text-green-500">✓</span>}
                  {lawStatuses[law] === "not_found" && <span className="text-xs text-amber-500">tidak ditemukan</span>}
                  <button type="button" onClick={() => removeLaw(law)} disabled={isRunning}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs ml-1 disabled:opacity-40">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded PDF list */}
          {uploadedLaws.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {uploadedLaws.map((law) => (
                <div key={law.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-violet-500/80 shrink-0">PDF</span>
                  <span className="text-xs text-zinc-300 flex-1 truncate">{law.name}</span>
                  {law.status === "uploading" && (
                    <span className="text-xs text-zinc-500 animate-pulse">mengekstrak…</span>
                  )}
                  {law.status === "done" && (
                    <span className="text-xs text-green-500">✓ {law.pages}hal</span>
                  )}
                  {law.status === "error" && (
                    <span className="text-xs text-red-400">{law.error}</span>
                  )}
                  <button type="button" onClick={() => removeUploadedLaw(law.id)} disabled={isRunning}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs ml-1 disabled:opacity-40">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {!isRunning && !canContinue && (
            <button type="submit" disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors">
              Generate Paper
            </button>
          )}
          {isRunning && (
            <button type="button" onClick={handleStop}
              className="px-6 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-sm font-medium transition-colors flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
              Pause
            </button>
          )}
          {canContinue && (
            <>
              <button type="button" onClick={handleContinue}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                Continue ({completedCount}/{totalChunkCount})
              </button>
              <button type="submit"
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium transition-colors">
                Mulai ulang
              </button>
            </>
          )}

          {status === "fetching_refs" && (
            <p className="text-xs text-zinc-500 animate-pulse">Mengambil referensi & teks UU…</p>
          )}
          {status === "generating" && activeLabel && (
            <p className="text-xs text-zinc-500 animate-pulse">
              Menulis: <span className="text-zinc-400">{activeLabel}</span>
              {totalChunkCount > 0 && <span className="text-zinc-600"> — {completedCount}/{totalChunkCount}</span>}
            </p>
          )}
          {status === "paused" && <p className="text-xs text-amber-500">Dijeda. Klik Continue untuk melanjutkan.</p>}
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
            <button onClick={handleContinue}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors">
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
              <p className="text-xs text-zinc-600">~{Math.round(displayOutput.split(/\s+/).length).toLocaleString()} kata</p>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors">
                  Copy
                </button>
                <button onClick={handleDownload}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20 transition-colors">
                  Download .md
                </button>
              </div>
            </div>
          )}
          <div ref={outputRef}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
            {displayOutput}
            {isRunning && <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
          </div>
        </div>
      )}

      {status === "idle" && !displayOutput && (
        <div className="text-center py-16 text-zinc-700">
          <p className="text-5xl mb-4">📝</p>
          <p className="text-sm">Masukkan judul dan klik Generate.</p>
          <p className="text-xs mt-2 text-zinc-700">Sitasi APA · Referensi OpenAlex · Teks UU dari Wikisource · Pause & continue</p>
        </div>
      )}
    </div>
  );
}
