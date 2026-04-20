"use client";

import { useState, useRef } from "react";

type Status = "idle" | "loading-model" | "processing" | "done" | "error";

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
  const [progress, setProgress] = useState(0);
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);
  const [resultSize, setResultSize] = useState<{ w: number; h: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
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
    if (!imgRef.current) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStatus("loading-model");
    setProgress(0);
    setResult("");
    setResultSize(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upscalerMod = await (import("upscaler") as Promise<any>);
      const Upscaler = upscalerMod.default ?? upscalerMod;
      const { default: model } = scale === 4
        ? await import("@upscalerjs/esrgan-slim/4x")
        : await import("@upscalerjs/esrgan-slim/2x");

      if (abort.signal.aborted) return;
      setStatus("processing");

      const upscaler = new Upscaler({ model });

      const upscaled = await upscaler.upscale(imgRef.current, {
        output: "base64",
        patchSize: 64,
        padding: 4,
        progress: (pct: number) => {
          if (!abort.signal.aborted) setProgress(Math.round(pct * 100));
        },
      });

      if (abort.signal.aborted) return;

      const dataUrl = `data:image/png;base64,${upscaled}`;
      setResult(dataUrl);

      if (origSize) setResultSize({ w: origSize.w * scale, h: origSize.h * scale });
      setProgress(100);
      setStatus("done");
    } catch (e: unknown) {
      if (abort.signal.aborted) return;
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
    abortRef.current?.abort();
    setStatus("idle");
    setOriginal("");
    setResult("");
    setFileName("");
    setError("");
    setShowOriginal(false);
    setOrigSize(null);
    setResultSize(null);
    setProgress(0);
    imgRef.current = null;
  }

  const busy = status === "loading-model" || status === "processing";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🔭</span>
          <h1 className="text-2xl font-bold text-white">Image Upscaler</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Upscale images 2× or 4× using AI. Great for restoring old photos or low-res images. Runs in your browser.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Upload */}
      {status === "idle" || status === "error" ? (
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
            <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP — recommended max 1000×1000px</p>
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
      ) : null}

      {/* Processing */}
      {busy && (
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
          <div className="w-full max-w-sm flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{status === "loading-model" ? "Loading AI model…" : `Upscaling ${scale}×…`}</span>
              <span className="font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            {status === "loading-model" && (
              <p className="text-xs text-zinc-600">Loading ESRGAN model (~20MB)</p>
            )}
          </div>
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
            <p className="text-xs text-zinc-600 text-center">
              {origSize.w}×{origSize.h}px → <span className="text-zinc-400">{resultSize.w}×{resultSize.h}px</span>
            </p>
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
