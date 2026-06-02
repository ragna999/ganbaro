"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading-model" | "processing" | "done" | "error";

const PRESET_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#d71920" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Gray", value: "#d1d5db" },
  { name: "Black", value: "#111827" },
];

function fileBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_") || "image";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function ChangeBackground() {
  const [status, setStatus] = useState<Status>("idle");
  const [original, setOriginal] = useState("");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState("");
  const [fileName, setFileName] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const originalRef = useRef("");
  const subjectRef = useRef("");
  const resultRef = useRef("");

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (originalRef.current) URL.revokeObjectURL(originalRef.current);
      if (subjectRef.current) URL.revokeObjectURL(subjectRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  function revokeResult() {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = "";
    }
    setResult("");
  }

  async function renderWithBackground(subjectUrl: string, color: string) {
    const img = await loadImage(subjectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export image."))), "image/png");
    });

    revokeResult();
    const url = URL.createObjectURL(blob);
    resultRef.current = url;
    setResult(url);
  }

  async function handleColorChange(color: string) {
    setBackgroundColor(color);
    if (!subject || status !== "done") return;

    try {
      await renderWithBackground(subject, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update background color.");
      setStatus("error");
    }
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }

    handleReset();
    setError("");
    setFileName(fileBaseName(file.name));
    const originalUrl = URL.createObjectURL(file);
    originalRef.current = originalUrl;
    setOriginal(originalUrl);
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
          if (key.includes("fetch")) setProgressLabel("Downloading model...");
          else if (key.includes("compute")) setProgressLabel("Removing background...");
          else setProgressLabel("Processing...");
        },
      });

      if (abort.signal.aborted) return;

      const subjectUrl = URL.createObjectURL(blob);
      subjectRef.current = subjectUrl;
      setSubject(subjectUrl);
      await renderWithBackground(subjectUrl, backgroundColor);

      if (abort.signal.aborted) return;
      setStatus("done");
      setProgress(100);
      setProgressLabel("");
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
    a.download = `${fileName || "image"}_bg.png`;
    a.click();
  }

  function handleReset() {
    abortRef.current?.abort();
    if (originalRef.current) {
      URL.revokeObjectURL(originalRef.current);
      originalRef.current = "";
    }
    if (subjectRef.current) {
      URL.revokeObjectURL(subjectRef.current);
      subjectRef.current = "";
    }
    revokeResult();
    setStatus("idle");
    setOriginal("");
    setSubject("");
    setFileName("");
    setError("");
    setShowOriginal(false);
    setProgress(0);
    setProgressLabel("");
  }

  const busy = status === "loading-model" || status === "processing";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎨</span>
          <h1 className="text-2xl font-bold text-white">Change Background</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Replace an image background with a solid color. Great for ID photos and clean product shots.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
          }}
          onClick={() => document.getElementById("change-bg-input")?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? "border-violet-500 bg-violet-500/5" : "border-zinc-800 hover:border-zinc-600"
          }`}
        >
          <input
            id="change-bg-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <p className="text-5xl mb-4">🖼️</p>
          <p className="text-sm text-zinc-400">Drop an image here or click to browse</p>
          <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP</p>
        </div>
      )}

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
              <span>{progressLabel || (status === "loading-model" ? "Loading AI model..." : "Removing background...")}</span>
              <span className="font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            {status === "loading-model" && progress === 0 && (
              <p className="text-xs text-zinc-600">First run downloads the background removal model.</p>
            )}
          </div>
        </div>
      )}

      {status === "done" && result && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={showOriginal ? original : result}
                alt={showOriginal ? "original" : "result"}
                className="w-full max-h-[28rem] object-contain"
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

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Background color
              </p>
              <div className="grid grid-cols-5 lg:grid-cols-1 gap-2 mb-4">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleColorChange(preset.value)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                      backgroundColor.toLowerCase() === preset.value
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                    title={preset.name}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-zinc-700 shrink-0"
                      style={{ backgroundColor: preset.value }}
                    />
                    <span className="hidden lg:inline text-xs text-zinc-300">{preset.name}</span>
                  </button>
                ))}
              </div>
              <label className="block text-xs text-zinc-500 mb-1.5">Custom color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-10 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Download PNG
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
            >
              New image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
