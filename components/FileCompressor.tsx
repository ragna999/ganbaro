"use client";

import { useState, useRef } from "react";

type FileType = "image" | "pdf" | "docx" | null;
type ImageFormat = "original" | "image/jpeg" | "image/png" | "image/webp";

interface Result {
  url: string;
  blob: Blob;
  fileName: string;
  originalSize: number;
  compressedSize: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectType(file: File): FileType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) return "pdf";
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) return "docx";
  return null;
}

export default function FileCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [quality, setQuality] = useState(70);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [imageFormat, setImageFormat] = useState<ImageFormat>("original");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    const type = detectType(f);
    if (!type) {
      setError("Format tidak didukung. Upload JPG/PNG/WebP, PDF, atau DOCX.");
      return;
    }
    setFile(f);
    setFileType(type);
    setResult(null);
    setError("");
  }

  // ─── Image compression ───────────────────────────────────────────────────
  async function compressImage(f: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (resizeEnabled && w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        const outFormat =
          imageFormat === "original" ? (f.type || "image/jpeg") : imageFormat;
        const q = outFormat === "image/png" ? undefined : quality / 100;
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
          outFormat,
          q
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ─── PDF compression ─────────────────────────────────────────────────────
  async function compressPdf(f: File): Promise<Blob> {
    const { PDFDocument } = await import("pdf-lib");
    const buffer = await f.arrayBuffer();
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const bytes = await pdf.save({ useObjectStreams: true });
    return new Blob([bytes], { type: "application/pdf" });
  }

  // ─── DOCX compression ────────────────────────────────────────────────────
  async function compressDocx(f: File): Promise<Blob> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await f.arrayBuffer());

    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i;
    const imageKeys = Object.keys(zip.files).filter(
      (name) => name.startsWith("word/media/") && imageExtensions.test(name)
    );

    await Promise.all(
      imageKeys.map(async (name) => {
        const data = await zip.files[name].async("arraybuffer");
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);

        const compressed = await new Promise<ArrayBuffer>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(
              async (b) => {
                if (!b) return reject(new Error("toBlob failed"));
                resolve(await b.arrayBuffer());
              },
              "image/jpeg",
              quality / 100
            );
          };
          img.onerror = reject;
          img.src = url;
        });

        zip.file(name, compressed);
      })
    );

    const bytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });
    return new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  // ─── Main handler ─────────────────────────────────────────────────────────
  async function handleCompress() {
    if (!file || !fileType || processing) return;
    setProcessing(true);
    setResult(null);
    setError("");

    try {
      let blob: Blob;
      if (fileType === "image") blob = await compressImage(file);
      else if (fileType === "pdf") blob = await compressPdf(file);
      else blob = await compressDocx(file);

      const ext =
        fileType === "image" && imageFormat !== "original"
          ? imageFormat.split("/")[1]
          : file.name.split(".").pop();
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const fileName = `${baseName}_compressed.${ext}`;

      setResult({
        url: URL.createObjectURL(blob),
        blob,
        fileName,
        originalSize: file.size,
        compressedSize: blob.size,
      });
    } catch (err) {
      console.error(err);
      setError("Kompresi gagal. File mungkin corrupt atau tidak didukung.");
    } finally {
      setProcessing(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.fileName;
    a.click();
  }

  const savings = result
    ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">File Compressor</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Kompres gambar, PDF, atau DOCX langsung di browser — tanpa upload ke server.
        </p>
      </div>

      <div className="shrink-0 space-y-4 mb-5">
        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file ? "border-violet-500 bg-violet-500/5" : "border-zinc-700 hover:border-violet-500"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {fileType === "image" ? "🖼️" : fileType === "pdf" ? "📄" : "📝"}
              </span>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                <p className="text-xs text-zinc-500">
                  {formatSize(file.size)} ·{" "}
                  <span className="capitalize text-violet-400">{fileType}</span>
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setFileType(null); setResult(null); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Ganti
              </button>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">📦</div>
              <p className="text-zinc-400 text-sm">Drop file di sini atau klik untuk browse</p>
              <p className="text-zinc-600 text-xs mt-1">JPG · PNG · WebP · PDF · DOCX</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Settings */}
        {file && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">

            {/* Quality — for image & docx */}
            {(fileType === "image" || fileType === "docx") && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs font-medium text-zinc-400">
                    {fileType === "docx" ? "Kualitas gambar di dalam file" : "Kualitas"}
                  </p>
                  <span className="text-xs font-mono text-violet-400">{quality}%</span>
                </div>
                <input
                  type="range" min={10} max={95} step={5}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
                  <span>Lebih kecil</span>
                  <span>Lebih bagus</span>
                </div>
              </div>
            )}

            {/* Image-specific settings */}
            {fileType === "image" && (
              <>
                {/* Format */}
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-2">Output format</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: "original", label: "Original" },
                      { value: "image/jpeg", label: "JPG" },
                      { value: "image/png", label: "PNG" },
                      { value: "image/webp", label: "WebP" },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setImageFormat(f.value as ImageFormat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          imageFormat === f.value
                            ? "bg-violet-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resize */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={resizeEnabled}
                      onChange={(e) => setResizeEnabled(e.target.checked)}
                      className="accent-violet-500"
                    />
                    <span className="text-xs font-medium text-zinc-400">Resize (max lebar)</span>
                  </label>
                  {resizeEnabled && (
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={320} max={3840} step={160}
                        value={maxWidth}
                        onChange={(e) => setMaxWidth(Number(e.target.value))}
                        className="flex-1 accent-violet-500"
                      />
                      <span className="text-xs font-mono text-violet-400 w-20 text-right">
                        {maxWidth}px
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PDF info */}
            {fileType === "pdf" && (
              <p className="text-xs text-zinc-500">
                PDF akan di-optimize dan di-save ulang. Teks tetap selectable.
                Hasil terbaik untuk PDF dengan banyak metadata atau gambar embedded.
              </p>
            )}
          </div>
        )}

        {/* Compress button */}
        {file && (
          <button
            onClick={handleCompress}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {processing ? "Mengompres…" : "Kompres Sekarang"}
          </button>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Sebelum</p>
              <p className="text-sm font-semibold text-zinc-300">{formatSize(result.originalSize)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Hemat</p>
              <p className={`text-lg font-bold ${savings > 0 ? "text-green-400" : "text-zinc-400"}`}>
                {savings > 0 ? `-${savings}%` : "~0%"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Sesudah</p>
              <p className="text-sm font-semibold text-zinc-300">{formatSize(result.compressedSize)}</p>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, 100 - savings)}%` }}
            />
          </div>

          {savings <= 0 && (
            <p className="text-xs text-zinc-500 text-center">
              File sudah optimal atau format tidak mendukung kompresi lebih lanjut.
            </p>
          )}

          <button
            onClick={handleDownload}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
          >
            Download {result.fileName}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!file && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-zinc-500 text-sm">Upload file untuk mulai kompres</p>
            <p className="text-zinc-700 text-xs mt-2">
              Semua proses terjadi di browser kamu — file tidak dikirim ke server manapun
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
