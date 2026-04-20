"use client";

import { useState, useRef } from "react";

type Status = "idle" | "processing" | "done" | "error";

const SCALE_OPTIONS = [
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

export default function ImageUpscaler() {
  const [status, setStatus] = useState<Status>("idle");
  const [original, setOriginal] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [scale, setScale] = useState(2);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    setError("");
    setResult("");
    setShowOriginal(false);
    setResultSize(null);
    setFileName(file.name.replace(/\.[^.]+$/, ""));

    const url = URL.createObjectURL(file);
    setOriginal(url);

    const img = new Image();
    img.onload = () => {
      setOrigSize({ w: img.width, h: img.height });
      imgRef.current = img;
    };
    img.src = url;
  }

  async function handleUpscale() {
    if (!imgRef.current || !origSize) return;

    setStatus("processing");
    setResult("");
    setResultSize(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = origSize.w * scale;
      canvas.height = origSize.h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Failed to export canvas")); return; }
          setResult(URL.createObjectURL(blob));
          setResultSize({ w: canvas.width, h: canvas.height });
          setStatus("done");
          resolve();
        }, "image/png");
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upscaling failed. Please try again.");
      setStatus("error");
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `${fileName || "image"}_${scale}x.png`;
    a.click();
  }

  function handleReset() {
    setStatus("idle");
    setOriginal("");
    setResult("");
    setFileName("");
    setError("");
    setShowOriginal(false);
    setOrigSize(null);
    setResultSize(null);
    imgRef.current = null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🔭</span>
          <h1 className="text-2xl font-bold text-white">Image Upscaler</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Upscale images 2× or 4× with high-quality Lanczos resampling. Great for enlarging photos or low-res images. Runs in your browser.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Upload */}
      {(status === "idle" || status === "error") && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            onClick={() => document.getElementById("up-input")?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              dragOver ? "border-violet-500 bg-violet-500/5" : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            <input id="up-input" type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            <p className="text-5xl mb-4">🔭</p>
            <p className="text-sm text-zinc-400">Drop an image here or click to browse</p>
            <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP</p>
          </div>

          {original && origSize && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original} alt="preview" className="w-full max-h-64 object-contain rounded-xl border border-zinc-800" />

              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Scale</p>
                  <div className="flex gap-2">
                    {SCALE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setScale(o.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          scale === o.value
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-zinc-600 mt-4">
                  {origSize.w}×{origSize.h}px → <span className="text-zinc-400">{origSize.w * scale}×{origSize.h * scale}px</span>
                </div>
              </div>

              <button
                onClick={handleUpscale}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                Upscale {scale}×
              </button>
            </>
          )}
        </div>
      )}

      {/* Processing */}
      {status === "processing" && (
        <div className="flex flex-col items-center gap-6 py-12">
          {original && (
            <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original} alt="original" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
              </div>
            </div>
          )}
          <p className="text-sm text-zinc-400">Upscaling {scale}×…</p>
        </div>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div className="flex flex-col gap-5">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={showOriginal ? original : result}
              alt="result"
              className="w-full max-h-96 object-contain"
            />
            <button
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              className="absolute bottom-3 right-3 text-xs bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-zinc-700 transition-colors"
            >
              {showOriginal ? "Release to see result" : "Hold to compare"}
            </button>
          </div>

          {resultSize && origSize && (
            <div className="text-center">
              <p className="text-xs text-zinc-500">
                {origSize.w}×{origSize.h}px → <span className="text-zinc-300 font-medium">{resultSize.w}×{resultSize.h}px</span>
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">Preview is scaled to fit — download to see the full {scale}× resolution.</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
              Download PNG
            </button>
            <button onClick={handleReset} className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
              New image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
