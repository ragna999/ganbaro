"use client";

import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function toMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

interface Chunk {
  index: number;
  start: number;
  end: number;
  label: string;
}

type ChunkState = "pending" | "processing" | "done" | "error";

const CHUNK_OPTIONS = [
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
  { label: "20 minutes", value: 1200 },
  { label: "30 minutes", value: 1800 },
];

export default function VideoSplitter() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [chunkSize, setChunkSize] = useState(600);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunkStates, setChunkStates] = useState<Record<number, ChunkState>>({});
  const [phase, setPhase] = useState<"upload" | "ready" | "splitting" | "done">("upload");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [loadingFfmpeg, setLoadingFfmpeg] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function loadFfmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current;
    setLoadingFfmpeg(true);
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    setFfmpegLoaded(true);
    setLoadingFfmpeg(false);
    return ffmpeg;
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, MOV, WebM).");
      return;
    }
    setError("");
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setPhase("upload");
    setChunks([]);
    setChunkStates({});
  }

  function handleDurationLoaded() {
    const d = videoRef.current?.duration;
    if (d && isFinite(d)) {
      setDuration(d);
      setPhase("ready");
      buildChunks(d, chunkSize);
    }
  }

  function buildChunks(d: number, size: number) {
    const result: Chunk[] = [];
    let start = 0;
    let i = 1;
    while (start < d) {
      const end = Math.min(start + size, d);
      result.push({ index: i, start, end, label: `Part ${i} (${formatTime(start)} – ${formatTime(end)})` });
      start = end;
      i++;
    }
    setChunks(result);
  }

  function handleChunkSizeChange(val: number) {
    setChunkSize(val);
    if (duration) buildChunks(duration, val);
  }

  async function handleSplit() {
    if (!videoFile || chunks.length === 0) return;
    setPhase("splitting");
    setError("");

    const states: Record<number, ChunkState> = {};
    chunks.forEach((c) => { states[c.index] = "pending"; });
    setChunkStates({ ...states });

    let ffmpeg: FFmpeg;
    try {
      ffmpeg = await loadFfmpeg();
    } catch (e) {
      setError(`Failed to load ffmpeg: ${toMsg(e)}`);
      setPhase("ready");
      return;
    }

    const inputName = "input" + (videoFile.name.match(/\.\w+$/)?.[0] ?? ".mp4");
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
    } catch (e) {
      setError(`Failed to load video: ${toMsg(e)}`);
      setPhase("ready");
      return;
    }

    const ext = videoFile.name.match(/\.\w+$/)?.[0] ?? ".mp4";
    const baseName = videoFile.name.replace(/\.\w+$/, "");

    for (const chunk of chunks) {
      setChunkStates((prev) => ({ ...prev, [chunk.index]: "processing" }));
      try {
        const outName = `chunk_${chunk.index}${ext}`;
        await ffmpeg.exec([
          "-i", inputName,
          "-ss", String(chunk.start),
          "-to", String(chunk.end),
          "-c", "copy",
          outName,
        ]);
        const data = await ffmpeg.readFile(outName);
        const url = URL.createObjectURL(
          new Blob([(data as Uint8Array).buffer as ArrayBuffer], { type: videoFile.type || "video/mp4" })
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}_part${chunk.index}${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        await ffmpeg.deleteFile(outName);
        setChunkStates((prev) => ({ ...prev, [chunk.index]: "done" }));
      } catch (e) {
        setChunkStates((prev) => ({ ...prev, [chunk.index]: "error" }));
        setError(`Part ${chunk.index} failed: ${toMsg(e)}`);
      }
    }

    setPhase("done");
  }

  const totalChunks = chunks.length;
  const doneCount = Object.values(chunkStates).filter((s) => s === "done").length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎞️</span>
          <h1 className="text-2xl font-bold text-white">Video Splitter</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Split a long video into smaller chunks. Runs entirely in your browser — nothing is uploaded to a server.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
        onClick={() => document.getElementById("vs-input")?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors mb-5 ${
          dragOver ? "border-violet-500 bg-violet-500/5" : "border-zinc-800 hover:border-zinc-600"
        }`}
      >
        <input id="vs-input" type="file" accept="video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        {videoFile ? (
          <div>
            <p className="text-sm font-medium text-zinc-200">{videoFile.name}</p>
            <p className="text-xs text-zinc-500 mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-3">🎞️</p>
            <p className="text-sm text-zinc-400">Drop a video here or click to browse</p>
            <p className="text-xs text-zinc-600 mt-1">MP4, MOV, WebM</p>
          </div>
        )}
      </div>

      {/* Hidden video for duration detection */}
      {videoUrl && (
        <video ref={videoRef} src={videoUrl} onLoadedMetadata={handleDurationLoaded} className="hidden" />
      )}

      {/* Config + preview */}
      {phase !== "upload" && duration && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Chunk size</label>
              <select
                value={chunkSize}
                onChange={(e) => handleChunkSizeChange(Number(e.target.value))}
                disabled={phase === "splitting"}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
              >
                {CHUNK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-zinc-500 mt-4">
              Total duration: <span className="text-zinc-300">{formatTime(duration)}</span>
              <span className="mx-2">→</span>
              <span className="text-zinc-300">{chunks.length} part{chunks.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Chunk list */}
          <div className="flex flex-col gap-2">
            {chunks.map((chunk) => {
              const state = chunkStates[chunk.index] ?? "pending";
              return (
                <div key={chunk.index} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{chunk.label}</p>
                    <p className="text-xs text-zinc-600">{Math.round(chunk.end - chunk.start)}s</p>
                  </div>
                  <div className="shrink-0">
                    {state === "pending" && <span className="text-xs text-zinc-600">Waiting</span>}
                    {state === "processing" && (
                      <span className="flex items-center gap-1.5 text-xs text-violet-400">
                        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Processing…
                      </span>
                    )}
                    {state === "done" && <span className="text-xs text-green-400">✓ Downloaded</span>}
                    {state === "error" && <span className="text-xs text-red-400">Failed</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action */}
          {phase === "ready" && (
            <button
              onClick={handleSplit}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              {loadingFfmpeg ? "Loading ffmpeg…" : `Split into ${chunks.length} parts`}
            </button>
          )}

          {phase === "splitting" && (
            <div className="text-center text-sm text-zinc-400">
              Downloading {doneCount} / {totalChunks} parts…
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 text-center">
                All {totalChunks} parts downloaded!
              </div>
              <button
                onClick={() => { setPhase("upload"); setVideoFile(null); setVideoUrl(""); setDuration(null); setChunks([]); setChunkStates({}); setError(""); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors self-start"
              >
                ← Split another video
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
