"use client";

import { useState, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";

const SIZES = [128, 256, 512, 1024];
const ERROR_LEVELS = [
  { value: "L", label: "L — Low (7%)" },
  { value: "M", label: "M — Medium (15%)" },
  { value: "Q", label: "Q — Quartile (25%)" },
  { value: "H", label: "H — High (30%)" },
] as const;

type ErrorLevel = "L" | "M" | "Q" | "H";

export default function QrGenerator() {
  const [input, setInput] = useState("");
  const [size, setSize] = useState(256);
  const [fgColor, setFgColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("#18181b");
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const canvasRef = useRef<HTMLDivElement>(null);

  const hasInput = input.trim().length > 0;

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qrcode.png";
    a.click();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🔗</span>
          <h1 className="text-2xl font-bold text-white">QR Code Generator</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Generate a QR code from any URL or text. Download as PNG. Runs entirely in your browser.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Controls */}
        <div className="flex-1 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">URL or Text</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com or any text…"
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Size</label>
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>{s} × {s} px</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Error Correction</label>
            <select
              value={errorLevel}
              onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
            >
              {ERROR_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">QR Color</label>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span className="text-xs text-zinc-400 font-mono">{fgColor}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Background</label>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span className="text-xs text-zinc-400 font-mono">{bgColor}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!hasInput}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors"
          >
            Download PNG
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-start justify-center sm:justify-start">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-medium text-zinc-400 self-start">Preview</p>
            <div
              ref={canvasRef}
              className="rounded-xl overflow-hidden border border-zinc-800"
              style={{ background: bgColor }}
            >
              {hasInput ? (
                <QRCodeCanvas
                  value={input}
                  size={192}
                  fgColor={fgColor}
                  bgColor={bgColor}
                  level={errorLevel}
                  marginSize={2}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-zinc-700 text-xs"
                  style={{ width: 192, height: 192 }}
                >
                  Enter text to preview
                </div>
              )}
            </div>
            {hasInput && (
              <p className="text-xs text-zinc-600">
                Will download at {size}×{size}px
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
