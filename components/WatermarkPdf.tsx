"use client";

import { useState, useRef } from "react";

const OPACITY_OPTIONS = [
  { label: "Light",  value: 0.15 },
  { label: "Medium", value: 0.3  },
  { label: "Heavy",  value: 0.5  },
];

const ANGLE_OPTIONS = [
  { label: "Diagonal", value: 45 },
  { label: "Horizontal", value: 0 },
];

const POSITION_OPTIONS = [
  { label: "Center", value: "center" },
  { label: "Tiled",  value: "tiled"  },
];

export default function WatermarkPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [angle, setAngle] = useState(45);
  const [position, setPosition] = useState("center");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function handleApply() {
    if (!file || !text.trim() || processing) return;
    setProcessing(true);
    setError("");

    try {
      const { PDFDocument, rgb, degrees, StandardFonts } = await import("pdf-lib");

      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);

      const pages = pdf.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (position === "center") {
          const fontSize = Math.min(width, height) * 0.1;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, {
            x: width / 2 - textWidth / 2,
            y: height / 2,
            size: fontSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity,
            rotate: degrees(angle),
          });
        } else {
          // Tiled
          const fontSize = Math.min(width, height) * 0.06;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const gapX = textWidth + 60;
          const gapY = fontSize + 60;
          for (let x = 0; x < width + gapX; x += gapX) {
            for (let y = 0; y < height + gapY; y += gapY) {
              page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(0.5, 0.5, 0.5),
                opacity,
                rotate: degrees(angle),
              });
            }
          }
        }
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(".pdf", "_watermarked.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to apply watermark. The file may be encrypted or corrupt.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    
      <div className="flex flex-col p-4 sm:p-8">
        {/* Header */}
        <div className="mb-5 shrink-0">
          <h2 className="text-2xl font-bold text-zinc-100">Watermark PDF</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Add a text watermark to every page of a PDF. Runs entirely in your browser.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !processing && fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className={`shrink-0 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-5 ${
            file ? "border-violet-500 bg-violet-500/5" : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              {!processing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(""); }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">🔏</div>
              <p className="text-zinc-300 text-sm font-medium">Drop PDF here or click to browse</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        {/* Settings */}
        <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5 mb-5">
          {/* Watermark text */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Watermark text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={40}
              placeholder="e.g. CONFIDENTIAL, DRAFT, DO NOT COPY"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Opacity */}
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Opacity</p>
            <div className="flex gap-2">
              {OPACITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOpacity(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    opacity === opt.value
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Angle */}
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Angle</p>
            <div className="flex gap-2">
              {ANGLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAngle(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    angle === opt.value
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Layout</p>
            <div className="flex gap-2">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPosition(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    position === opt.value
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mb-4 shrink-0">{error}</p>}

        <button
          onClick={handleApply}
          disabled={!file || !text.trim() || processing}
          className="shrink-0 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {processing ? "Applying watermark…" : "Apply Watermark and Download"}
        </button>

        {!file && (
          <div className="py-12 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">🔏</div>
              <p className="text-zinc-500 text-sm">Upload a PDF to add a watermark</p>
              <p className="text-zinc-700 text-xs mt-1">Works on all pages at once</p>
            </div>
          </div>
        )}
      </div>
  );
}
