"use client";

import { useState, useRef, useCallback } from "react";

interface ImageItem {
  id: string;
  file: File;
  url: string;
  name: string;
}

type PageSize = "fit" | "a4" | "letter";

const PAGE_SIZES = {
  a4:     { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

async function fileToImageEl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function fileToEmbeddable(
  file: File
): Promise<{ type: "jpg" | "png"; data: Uint8Array; width: number; height: number }> {
  const img = await fileToImageEl(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);

  const isJpeg = file.type === "image/jpeg";
  const mimeType = isJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), mimeType, 0.92)
  );
  const buf = await blob.arrayBuffer();
  return {
    type: isJpeg ? "jpg" : "png",
    data: new Uint8Array(buf),
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export default function ImageToPdf() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOver = useRef<string | null>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) { setError("Only image files are supported (JPG, PNG, WebP, etc.)"); return; }
    setError("");
    setImages((prev) => [
      ...prev,
      ...arr.map((f) => ({ id: uid(), file: f, url: URL.createObjectURL(f), name: f.name })),
    ]);
  }, []);

  function remove(id: string) {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  function move(id: string, dir: -1 | 1) {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  async function handleConvert() {
    if (!images.length || processing) return;
    setProcessing(true);
    setError("");

    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();

      for (const item of images) {
        const { type, data, width, height } = await fileToEmbeddable(item.file);
        const embedded =
          type === "jpg" ? await doc.embedJpg(data) : await doc.embedPng(data);

        let pw: number, ph: number;
        if (pageSize === "fit") {
          pw = width;
          ph = height;
        } else {
          const ps = PAGE_SIZES[pageSize];
          const scale = Math.min(ps.width / width, ps.height / height);
          pw = ps.width;
          ph = ps.height;
          const dw = width * scale;
          const dh = height * scale;
          const page = doc.addPage([pw, ph]);
          page.drawImage(embedded, {
            x: (pw - dw) / 2,
            y: (ph - dh) / 2,
            width: dw,
            height: dh,
          });
          continue;
        }

        const page = doc.addPage([pw, ph]);
        page.drawImage(embedded, { x: 0, y: 0, width: pw, height: ph });
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col p-4 sm:p-8">
        {/* Header */}
        <div className="mb-5 shrink-0">
          <h2 className="text-2xl font-bold text-zinc-100">Image to PDF</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Combine multiple images into a single PDF. Everything runs in your browser.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          className="shrink-0 border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-8 text-center cursor-pointer transition-colors mb-5"
        >
          <div className="text-4xl mb-2">🖼️</div>
          <p className="text-zinc-300 text-sm font-medium">Drop images here or click to browse</p>
          <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP, GIF supported</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />

        {error && <p className="text-red-400 text-xs mb-4 shrink-0">{error}</p>}

        {/* Image list */}
        {images.length > 0 && (
          <>
            <div className="shrink-0 flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {images.length} image{images.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => { images.forEach((i) => URL.revokeObjectURL(i.url)); setImages([]); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
              {images.map((item, idx) => (
                <div key={item.id} className="relative group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-28 object-cover"
                  />
                  {/* Order badge */}
                  <span className="absolute top-1.5 left-1.5 bg-zinc-900/80 text-zinc-300 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {idx + 1}
                  </span>
                  {/* Controls overlay */}
                  <div className="absolute inset-0 bg-zinc-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => move(item.id, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 text-xs transition-colors"
                      title="Move left"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-900/80 hover:bg-red-700 text-white text-xs transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => move(item.id, 1)}
                      disabled={idx === images.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 text-xs transition-colors"
                      title="Move right"
                    >
                      →
                    </button>
                  </div>
                  <p className="px-2 py-1.5 text-xs text-zinc-500 truncate">{item.name}</p>
                </div>
              ))}

              {/* Add more */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-violet-500 rounded-xl cursor-pointer transition-colors text-zinc-600 hover:text-zinc-400"
              >
                <span className="text-2xl mb-1">+</span>
                <span className="text-xs">Add more</span>
              </div>
            </div>

            {/* Settings */}
            <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
              <p className="text-xs font-medium text-zinc-400 mb-3">Page size</p>
              <div className="flex gap-2">
                {([
                  { value: "fit",    label: "Fit to image" },
                  { value: "a4",     label: "A4" },
                  { value: "letter", label: "Letter" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPageSize(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      pageSize === opt.value
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {pageSize !== "fit" && (
                <p className="text-xs text-zinc-600 mt-2">
                  Images will be centered and scaled to fit the page.
                </p>
              )}
            </div>

            {/* Convert button */}
            <button
              onClick={handleConvert}
              disabled={processing}
              className="shrink-0 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              {processing ? "Generating PDF…" : `Convert ${images.length} image${images.length !== 1 ? "s" : ""} to PDF`}
            </button>
          </>
        )}

        {/* Empty state */}
        {images.length === 0 && (
          <div className="py-16 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">📑</div>
              <p className="text-zinc-500 text-sm">Upload images to get started</p>
              <p className="text-zinc-700 text-xs mt-1">Drag and drop or click the box above</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
