"use client";

import { useState, useRef, useCallback } from "react";

interface PdfItem {
  id: string;
  file: File;
  name: string;
  pages: number | null;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

async function getPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  return pdf.getPageCount();
}

export default function PdfMerger() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) { setError("Only PDF files are supported."); return; }
    setError("");

    const newItems: PdfItem[] = pdfs.map((f) => ({
      id: uid(), file: f, name: f.name, pages: null,
    }));
    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const count = await getPageCount(item.file);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, pages: count } : i))
        );
      } catch {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, pages: -1 } : i))
        );
      }
    }
  }, []);

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  async function handleMerge() {
    if (items.length < 2 || processing) return;
    setProcessing(true);
    setError("");

    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();

      for (const item of items) {
        const buf = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }

      const bytes = await merged.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to merge PDFs. One or more files may be corrupt or encrypted.");
    } finally {
      setProcessing(false);
    }
  }

  const totalPages = items.reduce((sum, i) => sum + (i.pages && i.pages > 0 ? i.pages : 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col p-4 sm:p-8">
        {/* Header */}
        <div className="mb-5 shrink-0">
          <h2 className="text-2xl font-bold text-zinc-100">PDF Merger</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Combine multiple PDFs into one. Drag to reorder, then merge.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          className="shrink-0 border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-8 text-center cursor-pointer transition-colors mb-5"
        >
          <div className="text-4xl mb-2">📄</div>
          <p className="text-zinc-300 text-sm font-medium">Drop PDFs here or click to browse</p>
          <p className="text-zinc-600 text-xs mt-1">Select multiple files at once</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />

        {error && <p className="text-red-400 text-xs mb-4 shrink-0">{error}</p>}

        {/* PDF list */}
        {items.length > 0 && (
          <>
            <div className="shrink-0 flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {items.length} file{items.length !== 1 ? "s" : ""}
                {totalPages > 0 && ` · ${totalPages} pages total`}
              </p>
              <button
                onClick={() => setItems([])}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2 mb-5">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                >
                  <span className="text-xs font-bold text-zinc-600 w-5 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-lg shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.pages === null
                        ? "Reading…"
                        : item.pages === -1
                        ? "Could not read"
                        : `${item.pages} page${item.pages !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => move(item.id, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-xs transition-colors"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(item.id, 1)}
                      disabled={idx === items.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-xs transition-colors"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-400 text-xs transition-colors ml-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {/* Add more row */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-zinc-800 hover:border-violet-500 rounded-xl px-4 py-3 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
              >
                <span>+</span> Add more PDFs
              </button>
            </div>

            <button
              onClick={handleMerge}
              disabled={processing || items.length < 2}
              className="shrink-0 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              {processing
                ? "Merging…"
                : items.length < 2
                ? "Add at least 2 PDFs to merge"
                : `Merge ${items.length} PDFs into one`}
            </button>
          </>
        )}

        {items.length === 0 && (
          <div className="py-16 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">📎</div>
              <p className="text-zinc-500 text-sm">Upload PDFs to get started</p>
              <p className="text-zinc-700 text-xs mt-1">Files are never sent to any server</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
