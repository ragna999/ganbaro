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
type Status = "queued" | "processing" | "done";

// char cell dimensions used consistently across generation + rendering
const CHAR_W   = 0.6;
const CHAR_H   = 1.15;
const ASPECT   = CHAR_W / CHAR_H;
const MAX_FILES = 20;
const MAX_DIM   = 1920; // resize before processing to cap RAM usage

interface BatchItem {
  id: string;
  file: File;
  src: string;
  ascii: string;
  previewUrl: string; // canvas rendered at small size
  status: Status;
}

// Resize large images to MAX_DIM before processing to cap memory usage
function resizeSrc(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      if (scale === 1) { resolve(src); return; }
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL());
    };
    img.src = src;
  });
}

function asciiFromSrc(src: string, w: number, cs: CharSet, inv: boolean): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const chars = CHAR_SETS[cs];
      const h = Math.round(w * (img.height / img.width) * ASPECT);
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
          const b = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          result += chars[Math.floor((inv ? 1 - b : b) * (chars.length - 1))];
        }
        result += "\n";
      }
      resolve(result);
    };
    img.src = src;
  });
}

function renderCanvas(ascii: string, theme: Theme, fontSize: number): HTMLCanvasElement {
  const lines = ascii.split("\n").filter((_, i, a) => i < a.length - 1); // trim trailing newline
  const cols = Math.max(...lines.map((l) => l.length));
  const cw = fontSize * CHAR_W;
  const ch = fontSize * CHAR_H;
  const canvas = document.createElement("canvas");
  canvas.width  = Math.ceil(cols * cw);
  canvas.height = Math.ceil(lines.length * ch);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme === "dark" ? "#09090b" : "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.fillStyle = theme === "dark" ? "#e4e4e7" : "#18181b";
  lines.forEach((line, i) => ctx.fillText(line, 0, (i + 1) * ch));
  return canvas;
}

function renderToBlob(ascii: string, theme: Theme, format: Format): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = renderCanvas(ascii, theme, 10);
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    canvas.toBlob((b) => resolve(b!), mime, format === "jpg" ? 0.92 : undefined);
  });
}

// Small preview — renders at reduced font size so it fits in a card
function renderPreviewUrl(ascii: string, theme: Theme): string {
  return renderCanvas(ascii, theme, 3).toDataURL();
}

export default function AsciiArt() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [width, setWidth]       = useState(100);
  const [charSet, setCharSet]   = useState<CharSet>("classic");
  const [inverted, setInverted] = useState(false);
  const [theme, setTheme]       = useState<Theme>("dark");
  const [format, setFormat]     = useState<Format>("png");
  const [running, setRunning]   = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const slots = MAX_FILES - items.length;
    if (slots <= 0) return;
    const allowed = imageFiles.slice(0, slots);
    const newItems: BatchItem[] = allowed.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file, src: "", ascii: "", previewUrl: "", status: "queued",
    }));
    newItems.forEach((item) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, src } : it));
      };
      reader.readAsDataURL(item.file);
    });
    setItems((prev) => [...prev, ...newItems]);
  }

  const handleGenerate = useCallback(async () => {
    const targets = items.filter((it) => it.src && it.status !== "processing");
    if (!targets.length || running) return;
    setRunning(true);
    setDoneCount(0);

    for (const item of targets) {
      setItems((prev) => prev.map((it) =>
        it.id === item.id ? { ...it, status: "processing" } : it
      ));
      const resized = await resizeSrc(item.src);
      const ascii = await asciiFromSrc(resized, width, charSet, inverted);
      const previewUrl = renderPreviewUrl(ascii, theme);
      setItems((prev) => prev.map((it) =>
        it.id === item.id ? { ...it, ascii, previewUrl, status: "done" } : it
      ));
      setDoneCount((n) => n + 1);
    }
    setRunning(false);
  }, [items, width, charSet, inverted, theme, running]);

  async function downloadOne(item: BatchItem) {
    const blob = await renderToBlob(item.ascii, theme, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.file.name.replace(/\.[^.]+$/, "")}_ascii.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    const done = items.filter((it) => it.status === "done");
    if (!done.length) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(done.map(async (item) => {
      const blob = await renderToBlob(item.ascii, theme, format);
      zip.file(`${item.file.name.replace(/\.[^.]+$/, "")}_ascii.${format}`, blob);
    }));
    const bytes = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(bytes);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ascii-art-batch.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  const doneItems   = items.filter((it) => it.status === "done");
  const totalReady  = items.filter((it) => it.src).length;
  const progress    = totalReady ? Math.round((doneCount / totalReady) * 100) : 0;

  return (
    
      <div className="p-4 sm:p-8 space-y-5">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Image to ASCII Art</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Convert images into ASCII art. Upload multiple for batch generation.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
        >
          <div className="text-3xl mb-2">🖼️</div>
          <p className="text-zinc-400 text-sm">Drop images here or click to browse</p>
          <p className="text-zinc-600 text-xs mt-1">JPG · PNG · GIF · WebP · Max {MAX_FILES} images</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

        {/* Queue */}
        {items.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
              <p className="text-xs font-medium text-zinc-400">
                {items.length} / {MAX_FILES} images in queue
              </p>
              <button onClick={() => { setItems([]); setDoneCount(0); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Clear all
              </button>
            </div>
            <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  {item.src
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.src} alt="" className="w-8 h-8 object-cover rounded shrink-0" />
                    : <div className="w-8 h-8 bg-zinc-800 rounded shrink-0 animate-pulse" />
                  }
                  <p className="text-xs text-zinc-300 flex-1 truncate">{item.file.name}</p>
                  <span className={`text-xs font-medium shrink-0 ${
                    item.status === "done"       ? "text-green-400" :
                    item.status === "processing" ? "text-violet-400 animate-pulse" :
                                                   "text-zinc-600"
                  }`}>
                    {item.status === "done" ? "✓ Done" : item.status === "processing" ? "Processing…" : "Queued"}
                  </span>
                  {item.status !== "processing" && (
                    <button onClick={() => setItems((p) => p.filter((it) => it.id !== item.id))}
                      className="text-zinc-700 hover:text-zinc-400 text-base leading-none shrink-0 transition-colors">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Width</p>
                <span className="text-xs font-mono text-violet-400">{width} chars</span>
              </div>
              <input type="range" min={40} max={200} step={10} value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-violet-500" />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Character set</p>
              <select value={charSet} onChange={(e) => setCharSet(e.target.value as CharSet)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500">
                <option value="classic">Classic (@#%*+;:.)</option>
                <option value="detailed">Detailed (70 chars)</option>
                <option value="blocks">Blocks (█▓▒░)</option>
                <option value="simple">Simple (#@+-.)</option>
              </select>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Background</p>
              <div className="flex gap-2">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <button key={t} onClick={() => setTheme(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      theme === t ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}>
                    {t === "dark" ? "🌑 Dark" : "☀️ Light"}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-2">Options</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={inverted} className="accent-violet-500"
                  onChange={(e) => setInverted(e.target.checked)} />
                <span className="text-xs text-zinc-300">Invert brightness</span>
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={handleGenerate} disabled={running || totalReady === 0}
              className="flex-1 min-w-[140px] py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors">
              {running
                ? `Generating… ${doneCount}/${totalReady}`
                : `Generate${totalReady > 1 ? ` All ${totalReady}` : ""}`}
            </button>
            <div className="flex rounded-xl overflow-hidden border border-zinc-700">
              {(["png", "jpg"] as Format[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`px-4 py-3 text-xs font-medium uppercase transition-colors ${
                    format === f ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {doneItems.length > 1 && (
              <button onClick={downloadAll}
                className="flex-1 min-w-[140px] py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium text-sm transition-colors">
                Download All ({doneItems.length}) .zip
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        {running && (
          <div className="space-y-1.5">
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-zinc-600 text-right">{progress}%</p>
          </div>
        )}

        {/* Results grid */}
        {doneItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Results ({doneItems.length} generated)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {doneItems.map((item) => (
                <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                  {/* Canvas-rendered preview — correct aspect ratio */}
                  <div className={`flex items-center justify-center p-2 ${
                    theme === "dark" ? "bg-zinc-950" : "bg-white"
                  }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={`ASCII preview of ${item.file.name}`}
                      className="max-h-56 w-auto object-contain rounded"
                    />
                  </div>
                  {/* Footer */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-t border-zinc-800 mt-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt="" className="w-7 h-7 object-cover rounded shrink-0" />
                    <p className="text-xs text-zinc-400 flex-1 truncate">{item.file.name}</p>
                    <button onClick={() => downloadOne(item)}
                      className="shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded-lg transition-colors">
                      ↓ .{format}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="py-16 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">🖼️</div>
              <p className="text-zinc-500 text-sm">Upload images to get started</p>
              <p className="text-zinc-700 text-xs mt-1">Works best with high-contrast images</p>
            </div>
          </div>
        )}

      </div>
  );
}
