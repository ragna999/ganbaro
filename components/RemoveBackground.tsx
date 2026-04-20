"use client";

import { useState, useRef } from "react";

type Status = "idle" | "loading-model" | "processing" | "done" | "error";

export default function RemoveBackground() {
  const [status, setStatus] = useState<Status>("idle");
  const [original, setOriginal] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    setError("");
    setResult("");
    setShowOriginal(false);
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setOriginal(URL.createObjectURL(file));
    processImage(file);
  }

  async function processImage(file: File) {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStatus("loading-model");
    setProgress(0);
    setProgressLabel("");

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      if (abort.signal.aborted) return;
      setStatus("processing");

      const blob = await removeBackground(file, {
        model: "isnet",
        progress: (key: string, current: number, total: number) => {
          if (abort.signal.aborted) return;
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setProgress(pct);
          if (key.includes("fetch")) setProgressLabel("Downloading model…");
          else if (key.includes("compute")) setProgressLabel("Removing background…");
          else setProgressLabel("Processing…");
        },
      });

      if (abort.signal.aborted) return;
      setResult(URL.createObjectURL(blob));
      setStatus("done");
    } catch (e: unknown) {
      if (abort.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Processing failed. Please try again.");
      setStatus("error");
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `${fileName || "image"}_no_bg.png`;
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
  }

  const busy = status === "loading-model" || status === "processing";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">✂️</span>
          <h1 className="text-2xl font-bold text-white">Remove Background</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Remove the background from any image using AI. Runs entirely in your browser — nothing is uploaded.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Upload zone — only show when idle/error */}
      {(status === "idle" || status === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          onClick={() => document.getElementById("bg-input")?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? "border-violet-500 bg-violet-500/5" : "border-zinc-800 hover:border-zinc-600"
          }`}
        >
          <input id="bg-input" type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          <p className="text-5xl mb-4">🖼️</p>
          <p className="text-sm text-zinc-400">Drop an image here or click to browse</p>
          <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP</p>
        </div>
      )}

      {/* Processing state */}
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
              <span>{progressLabel || (status === "loading-model" ? "Loading AI model…" : "Removing background…")}</span>
              <span className="font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            {status === "loading-model" && progress === 0 && (
              <p className="text-xs text-zinc-600">First run downloads ~50MB model</p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div className="flex flex-col gap-5">
          {/* Preview with toggle */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23374151%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23374151%22%2F%3E%3C%2Fsvg%3E')]">
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

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Download PNG
            </button>
            <button
              onClick={() => document.getElementById("bg-input-new")?.click()}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
            >
              New image
            </button>
            <input id="bg-input-new" type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleReset(); handleFileSelect(f); } }} />
          </div>
        </div>
      )}
    </div>
  );
}
