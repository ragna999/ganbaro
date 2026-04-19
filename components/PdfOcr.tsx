"use client";

import { useState, useRef } from "react";

const LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "ind", label: "Indonesian" },
  { code: "eng+ind", label: "English + Indonesian" },
];

export default function PdfOcr() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [lang, setLang] = useState("eng");
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files supported");
      return;
    }
    setError("");
    setText("");
    setFile(f);
    setTotalPages(0);

    setStatus("Loading PDF…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
    const buffer = await f.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    setTotalPages(pdf.numPages);
    setStatus("");
  }

  async function handleOCR() {
    if (!file || processing) return;

    if (totalPages > 50) {
      setError(`This PDF has ${totalPages} pages. Use PDF Splitter first (max 50 pages for OCR).`);
      return;
    }

    setProcessing(true);
    setCurrentPage(0);
    setText("");
    setError("");

    try {
      setStatus("Loading PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

      setStatus("Loading Tesseract OCR engine…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(lang);

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;

      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        setCurrentPage(i);
        setStatus(`OCR page ${i} of ${pdf.numPages}…`);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        const { data: { text } } = await worker.recognize(canvas);
        fullText += text + "\n\n";
      }

      await worker.terminate();
      setText(fullText.trim());
      setStatus("");
    } catch (err) {
      console.error(err);
      setError("OCR failed. Make sure the file isn't corrupt and try again.");
      setStatus("");
    } finally {
      setProcessing(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadAsPdf() {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const fontSize = 12;
    const lineHeight = fontSize * 1.5;
    const margin = 50;
    const pageWidth = 595;
    const pageHeight = 842;
    const maxWidth = pageWidth - margin * 2;
    const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);

    // Word-wrap all paragraphs into lines
    const allLines: string[] = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) { allLines.push(""); continue; }
      const words = para.split(" ");
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
          allLines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) allLines.push(current);
    }

    // Fill pages
    for (let i = 0; i < allLines.length; i += linesPerPage) {
      const page = doc.addPage([pageWidth, pageHeight]);
      allLines.slice(i, i + linesPerPage).forEach((line, j) => {
        if (!line) return;
        page.drawText(line, {
          x: margin,
          y: pageHeight - margin - j * lineHeight,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      });
    }

    const bytes = await doc.save();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name ?? "ocr-result").replace(".pdf", "_ocr.pdf");
    a.click();
    URL.revokeObjectURL(url);
  }

  const progress = totalPages ? Math.round((currentPage / totalPages) * 100) : 0;
  const tooLarge = totalPages > 50;

  return (
    <div className="h-full overflow-y-auto"><div className="flex flex-col p-4 sm:p-8 sm:h-full">
      {/* Header */}
      <div className="mb-4 sm:mb-7 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">PDF OCR</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Extract text from scanned PDFs. Max 50 pages. Use PDF Splitter for larger files.
        </p>
      </div>

      <div className="shrink-0 space-y-4 mb-5">
        {/* Drop zone */}
        <div
          onClick={() => !processing && fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); if (!processing) { const f = e.dataTransfer.files[0]; if (f) handleFile(f); } }}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            tooLarge
              ? "border-red-700 bg-red-950/20"
              : file
              ? "border-violet-500 bg-violet-500/5"
              : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                <p className={`text-xs ${tooLarge ? "text-red-400" : "text-zinc-500"}`}>
                  {totalPages > 0
                    ? tooLarge
                      ? `${totalPages} pages, too large. Split first.`
                      : `${totalPages} pages, ready for OCR`
                    : "Loading info…"}
                </p>
              </div>
              {!processing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setTotalPages(0); setText(""); setError(""); }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-zinc-400 text-sm">Drop scanned PDF here or click to browse</p>
              <p className="text-zinc-600 text-xs mt-1">Max 50 pages</p>
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

        {/* Language + Start */}
        {file && !tooLarge && totalPages > 0 && (
          <div className="flex gap-3">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={processing}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <button
              onClick={handleOCR}
              disabled={processing}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {processing ? "Processing…" : "Start OCR"}
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* Progress */}
      {processing && (
        <div className="shrink-0 mb-5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-700">
            Running in your browser. May take a few minutes depending on page complexity.
          </p>
        </div>
      )}

      {/* Text output */}
      {text && !processing && (
        <div className="min-h-[200px] sm:flex-1 sm:min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <p className="text-sm font-medium text-zinc-300">
              Text extracted successfully ✓
            </p>
            <div className="flex gap-2">
              <button
                onClick={copyText}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  copied
                    ? "bg-green-700 text-white"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={downloadAsPdf}
                className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
              {text}
            </pre>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!file && (
        <div className="py-16 sm:flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-zinc-500 text-sm">Upload a scanned PDF to extract text</p>
            <p className="text-zinc-700 text-xs mt-1">Best results with clear, high-resolution scans</p>
          </div>
        </div>
      )}
    </div></div>
  );
}
