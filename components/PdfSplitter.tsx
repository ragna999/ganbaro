"use client";

import { useState, useRef } from "react";

interface Chunk {
  name: string;
  bytes: Uint8Array;
  startPage: number;
  endPage: number;
}

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pagesPerChunk, setPagesPerChunk] = useState(50);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files supported");
      return;
    }
    setError("");
    setChunks([]);
    setFile(f);

    const { PDFDocument } = await import("pdf-lib");
    const buffer = await f.arrayBuffer();
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    setTotalPages(pdf.getPageCount());
  }

  async function handleSplit() {
    if (!file || processing) return;
    setProcessing(true);
    setProgress(0);
    setChunks([]);
    setError("");

    try {
      const { PDFDocument } = await import("pdf-lib");
      const buffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const total = pdf.getPageCount();
      const numChunks = Math.ceil(total / pagesPerChunk);
      const result: Chunk[] = [];

      for (let i = 0; i < numChunks; i++) {
        const start = i * pagesPerChunk;
        const end = Math.min(start + pagesPerChunk, total);
        const indices = Array.from({ length: end - start }, (_, j) => start + j);

        const chunk = await PDFDocument.create();
        const pages = await chunk.copyPages(pdf, indices);
        pages.forEach((p) => chunk.addPage(p));
        const bytes = await chunk.save();

        result.push({
          name: `${file.name.replace(".pdf", "")}_part${i + 1}_of_${numChunks}.pdf`,
          bytes,
          startPage: start + 1,
          endPage: end,
        });

        setProgress(Math.round(((i + 1) / numChunks) * 100));
      }

      setChunks(result);
    } catch (err) {
      console.error(err);
      setError(`Failed: ${(err as Error).message}`);
    } finally {
      setProcessing(false);
    }
  }

  function downloadChunk(chunk: Chunk) {
    const blob = new Blob([chunk.bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = chunk.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    chunks.forEach((chunk, i) => {
      setTimeout(() => downloadChunk(chunk), i * 400);
    });
  }

  const numChunks = totalPages ? Math.ceil(totalPages / pagesPerChunk) : 0;

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-7 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">PDF Splitter</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Split large PDFs into smaller chunks. Use before PDF OCR for large files.
        </p>
      </div>

      <div className="shrink-0 space-y-4 mb-6">
        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file ? "border-violet-500 bg-violet-500/5" : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                <p className="text-xs text-zinc-500">{totalPages} pages total</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setTotalPages(0); setChunks([]); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">✂️</div>
              <p className="text-zinc-400 text-sm">Drop PDF here or click to browse</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Config */}
        {totalPages > 0 && (
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-300">Pages per chunk</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                → {numChunks} {numChunks === 1 ? "part" : "parts"} will be created
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={pagesPerChunk}
                onChange={(e) => setPagesPerChunk(Number(e.target.value))}
                className="w-32 accent-violet-500"
              />
              <span className="text-sm font-mono text-violet-400 w-16 text-right">
                {pagesPerChunk} pages
              </span>
            </div>
          </div>
        )}

        {/* Split button */}
        {totalPages > 0 && (
          <button
            onClick={handleSplit}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {processing ? `Processing… ${progress}%` : `Split into ${numChunks} ${numChunks === 1 ? "part" : "parts"}`}
          </button>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="shrink-0 mb-4 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Results */}
      {chunks.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-300">{chunks.length} {chunks.length === 1 ? "part" : "parts"} ready to download</p>
            <button
              onClick={downloadAll}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Download all
            </button>
          </div>
          <div className="space-y-2">
            {chunks.map((chunk, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">📄</span>
                  <div>
                    <p className="text-sm text-zinc-200">
                      Part {i + 1} of {chunks.length}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Pages {chunk.startPage}–{chunk.endPage}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadChunk(chunk)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!file && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">✂️</div>
            <p className="text-zinc-500 text-sm">Upload a PDF to get started</p>
            <p className="text-zinc-700 text-xs mt-1">Great for large books or thick documents</p>
          </div>
        </div>
      )}
    </div>
  );
}
