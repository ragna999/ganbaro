"use client";

import { useEffect, useRef, useState } from "react";

type OutputFormat = "png" | "jpeg";

interface ConvertedPage {
  pageNumber: number;
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
}

const SCALE_OPTIONS = [
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
  { label: "3x", value: 3 },
];

function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "_") || "pdf";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat): Promise<Blob> {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export image."))),
      mime,
      format === "jpeg" ? 0.92 : undefined
    );
  });
}

export default function PdfToImage() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [scale, setScale] = useState(2);
  const [converted, setConverted] = useState<ConvertedPage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      converted.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, [converted]);

  function clearConverted() {
    converted.forEach((page) => URL.revokeObjectURL(page.url));
    setConverted([]);
  }

  async function handleFile(nextFile: File) {
    if (!nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }

    setError("");
    clearConverted();
    setFile(nextFile);
    setTotalPages(0);
    setCurrentPage(0);

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const buffer = await nextFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      setTotalPages(pdf.numPages);
      setFromPage(1);
      setToPage(Math.min(pdf.numPages, 10));
    } catch (err) {
      console.error(err);
      setFile(null);
      setError("Failed to open this PDF. It may be encrypted, corrupt, or unsupported.");
    }
  }

  async function handleConvert() {
    if (!file || processing) return;

    const start = Math.max(1, Math.min(fromPage, totalPages));
    const end = Math.max(1, Math.min(toPage, totalPages));
    if (start > end) {
      setError("Page range is invalid. The first page must be before the last page.");
      return;
    }

    setProcessing(true);
    setError("");
    clearConverted();

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const results: ConvertedPage[] = [];
      const prefix = baseName(file.name);

      for (let pageNumber = start; pageNumber <= end; pageNumber++) {
        setCurrentPage(pageNumber);

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported in this browser.");

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await canvasToBlob(canvas, format);
        results.push({
          pageNumber,
          url: URL.createObjectURL(blob),
          name: `${prefix}_page_${pageNumber}.${format === "png" ? "png" : "jpg"}`,
          width: canvas.width,
          height: canvas.height,
          size: blob.size,
        });
      }

      setConverted(results);
    } catch (err) {
      console.error(err);
      setError("Conversion failed. Try a smaller page range or a lower scale.");
    } finally {
      setProcessing(false);
      setCurrentPage(0);
    }
  }

  function resetFile() {
    clearConverted();
    setFile(null);
    setTotalPages(0);
    setFromPage(1);
    setToPage(1);
    setError("");
    setCurrentPage(0);
  }

  const selectedCount =
    totalPages > 0 && fromPage <= toPage
      ? Math.max(0, Math.min(toPage, totalPages) - Math.max(fromPage, 1) + 1)
      : 0;
  const progress = selectedCount && currentPage
    ? Math.round(((currentPage - Math.max(fromPage, 1) + 1) / selectedCount) * 100)
    : 0;

  return (
    <div className="flex flex-col p-4 sm:p-8 sm:min-h-[calc(100vh-3.5rem)]">
      <div className="mb-4 sm:mb-7 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">PDF to Image</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Convert PDF pages to PNG or JPEG images. Everything runs in your browser.
        </p>
      </div>

      <div className="shrink-0 space-y-4 mb-6">
        <div
          onClick={() => !processing && fileInputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            if (!processing) {
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFile(dropped);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file ? "border-violet-500 bg-violet-500/5" : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🖼️</span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
                <p className="text-xs text-zinc-500">
                  {totalPages > 0 ? `${totalPages} pages total` : "Loading PDF info..."}
                </p>
              </div>
              {!processing && (
                <button
                  onClick={(e) => { e.stopPropagation(); resetFile(); }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">🖼️</div>
              <p className="text-zinc-400 text-sm">Drop PDF here or click to browse</p>
              <p className="text-zinc-600 text-xs mt-1">PNG and JPEG output supported</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleFile(selected);
            e.target.value = "";
          }}
        />

        {file && totalPages > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">From page</label>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={fromPage}
                  onChange={(e) => setFromPage(Number(e.target.value))}
                  disabled={processing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">To page</label>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={toPage}
                  onChange={(e) => setToPage(Number(e.target.value))}
                  disabled={processing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  disabled={processing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Scale</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  disabled={processing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  {SCALE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleConvert}
              disabled={processing || selectedCount === 0}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              {processing
                ? `Converting page ${currentPage}...`
                : `Convert ${selectedCount || 0} page${selectedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {processing && (
        <div className="shrink-0 mb-5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Rendering page {currentPage} of {Math.min(toPage, totalPages)}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {converted.length > 0 && (
        <div className="min-h-[200px] sm:flex-1 sm:min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-300">
              {converted.length} image{converted.length === 1 ? "" : "s"} ready
            </p>
            <button
              onClick={clearConverted}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {converted.map((page) => (
              <div key={page.pageNumber} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-zinc-950/70 h-52 flex items-center justify-center p-3">
                  <img
                    src={page.url}
                    alt={`Page ${page.pageNumber}`}
                    className="max-w-full max-h-full object-contain shadow-lg"
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">Page {page.pageNumber}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {page.width}x{page.height} · {formatBytes(page.size)}
                      </p>
                    </div>
                    <a
                      href={page.url}
                      download={page.name}
                      className="shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!file && (
        <div className="py-16 sm:flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">🖼️</div>
            <p className="text-zinc-500 text-sm">Upload a PDF to convert pages into images</p>
            <p className="text-zinc-700 text-xs mt-1">Choose PNG or JPEG, then download each page</p>
          </div>
        </div>
      )}
    </div>
  );
}
