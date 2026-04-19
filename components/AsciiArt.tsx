"use client";

import { useState, useRef, useCallback } from "react";

const CHAR_SETS = {
  classic:  "@#S%?*+;:,. ",
  detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  blocks:   "█▓▒░ ",
  simple:   "#@+-. ",
};

type CharSet = keyof typeof CHAR_SETS;
type Theme = "dark" | "light";
type Format = "png" | "jpg";

export default function AsciiArt() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [ascii, setAscii] = useState("");
  const [width, setWidth] = useState(100);
  const [charSet, setCharSet] = useState<CharSet>("classic");
  const [inverted, setInverted] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [format, setFormat] = useState<Format>("png");
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenImgRef = useRef<HTMLImageElement | null>(null);

  const generateAscii = useCallback(
    (src: string, w: number, cs: CharSet, inv: boolean) => {
      setProcessing(true);
      const img = new Image();
      img.onload = () => {
        hiddenImgRef.current = img;
        const chars = CHAR_SETS[cs];
        const aspectRatio = img.height / img.width;
        const h = Math.round(w * aspectRatio * 0.45);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        const { data } = ctx.getImageData(0, 0, w, h);
        let result = "";

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const brightness =
              (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
            const b = inv ? 1 - brightness : brightness;
            const charIndex = Math.floor(b * (chars.length - 1));
            result += chars[charIndex];
          }
          result += "\n";
        }

        setAscii(result);
        setProcessing(false);
      };
      img.src = src;
    },
    []
  );

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImageSrc(src);
      setAscii("");
      generateAscii(src, width, charSet, inverted);
    };
    reader.readAsDataURL(file);
  }

  function handleRegenerate() {
    if (imageSrc) generateAscii(imageSrc, width, charSet, inverted);
  }

  function downloadImage() {
    if (!ascii) return;

    const lines = ascii.split("\n");
    const cols = lines[0]?.length ?? 0;
    const rows = lines.length;

    const fontSize = 10;
    const charW = fontSize * 0.6;
    const charH = fontSize * 1.15;

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(cols * charW);
    canvas.height = Math.ceil(rows * charH);

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = theme === "dark" ? "#09090b" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.fillStyle = theme === "dark" ? "#e4e4e7" : "#18181b";

    lines.forEach((line, i) => {
      ctx.fillText(line, 0, (i + 1) * charH);
    });

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const quality = format === "jpg" ? 0.92 : undefined;
    const url = canvas.toDataURL(mimeType, quality);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ascii-art.${format}`;
    a.click();
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">Image to ASCII Art</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Convert any image into ASCII art and download as PNG or JPG.
        </p>
      </div>

      {/* Controls */}
      <div className="shrink-0 space-y-3 mb-5">
        {/* Upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
            imageSrc ? "border-violet-500 bg-violet-500/5" : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {imageSrc ? (
            <div className="flex items-center justify-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="preview" className="h-12 w-12 object-cover rounded-lg" />
              <p className="text-sm text-zinc-300">Image loaded — adjust settings below</p>
              <button
                onClick={(e) => { e.stopPropagation(); setImageSrc(null); setAscii(""); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-auto"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">🖼️</div>
              <p className="text-zinc-400 text-sm">Drop image here or click to browse</p>
              <p className="text-zinc-600 text-xs mt-1">JPG, PNG, GIF, WebP</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Settings row */}
        {imageSrc && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Width */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Width</p>
                <span className="text-xs font-mono text-violet-400">{width} chars</span>
              </div>
              <input
                type="range"
                min={40}
                max={200}
                step={10}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>

            {/* Char set */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Character set</p>
              <select
                value={charSet}
                onChange={(e) => setCharSet(e.target.value as CharSet)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500"
              >
                <option value="classic">Classic (@#%*+;:.)</option>
                <option value="detailed">Detailed (70 chars)</option>
                <option value="blocks">Blocks (█▓▒░)</option>
                <option value="simple">Simple (#@+-.)</option>
              </select>
            </div>

            {/* Theme */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Background</p>
              <div className="flex gap-2">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                      theme === t ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {t === "dark" ? "🌑 Dark" : "☀️ Light"}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Options</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inverted}
                  onChange={(e) => setInverted(e.target.checked)}
                  className="accent-violet-500"
                />
                <span className="text-xs text-zinc-300">Invert brightness</span>
              </label>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {imageSrc && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={handleRegenerate}
              disabled={processing}
              className="flex-1 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 text-sm font-medium transition-colors"
            >
              {processing ? "Generating…" : "Generate"}
            </button>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {(["png", "jpg"] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-2.5 text-xs font-medium transition-colors uppercase ${
                    format === f ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={downloadImage}
              disabled={!ascii || processing}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              Download .{format}
            </button>
          </div>
        )}
      </div>

      {/* ASCII Preview */}
      {ascii && !processing && (
        <div
          className={`flex-1 min-h-0 overflow-auto rounded-xl p-4 font-mono text-[7px] leading-[1.1] whitespace-pre ${
            theme === "dark" ? "bg-zinc-950 text-zinc-300" : "bg-white text-zinc-900"
          }`}
        >
          {ascii}
        </div>
      )}

      {processing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )}

      {!imageSrc && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">🖼️</div>
            <p className="text-zinc-500 text-sm">Upload an image to convert</p>
            <p className="text-zinc-700 text-xs mt-1">Works best with high-contrast images</p>
          </div>
        </div>
      )}
    </div>
  );
}
