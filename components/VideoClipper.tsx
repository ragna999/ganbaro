"use client";

import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { ClipSuggestion } from "@/app/api/clip-suggest/route";

type Phase = "upload" | "processing" | "results";
type ProcessingStep = "extracting" | "transcribing" | "suggesting";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function VideoClipper() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("extracting");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ClipSuggestion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFfmpeg = useCallback(async () => {
    if (ffmpegLoaded) return ffmpegRef.current!;
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    setFfmpegLoaded(true);
    return ffmpeg;
  }, [ffmpegLoaded]);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, MOV, WebM).");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large. Max 500MB.");
      return;
    }
    setError("");
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
  }

  function toMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    try { return JSON.stringify(e); } catch { return "Unknown error"; }
  }

  async function handleProcess() {
    if (!videoFile) return;
    setError("");
    setPhase("processing");

    // Step 1: Load ffmpeg + extract audio
    setProcessingStep("extracting");
    let audioBlob: Blob;
    try {
      const ffmpeg = await loadFfmpeg();
      const inputName = "input" + (videoFile.name.match(/\.\w+$/)?.[0] ?? ".mp4");
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      const ret = await ffmpeg.exec([
        "-i", inputName,
        "-vn", "-ar", "16000", "-ac", "1",
        "-c:a", "pcm_s16le",
        "audio.wav",
      ]);
      if (ret !== 0) throw new Error(`ffmpeg audio extraction failed (exit ${ret})`);
      const audioData = await ffmpeg.readFile("audio.wav");
      audioBlob = new Blob([(audioData as Uint8Array).buffer as ArrayBuffer], { type: "audio/wav" });
    } catch (e) {
      setError(`Audio extraction failed: ${toMsg(e)}`);
      setPhase("upload");
      return;
    }

    // Step 2: Transcribe
    setProcessingStep("transcribing");
    let segments: { start: number; end: number; text: string }[];
    try {
      const fd = new FormData();
      fd.append("audio", new File([audioBlob], "audio.wav", { type: "audio/wav" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      if (!data.segments || data.segments.length === 0) throw new Error("No speech detected in this video.");
      segments = data.segments;
    } catch (e) {
      setError(`Transcription failed: ${toMsg(e)}`);
      setPhase("upload");
      return;
    }

    // Step 3: Suggest clips
    setProcessingStep("suggesting");
    try {
      const res = await fetch("/api/clip-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get suggestions.");
      const clips: ClipSuggestion[] = data.suggestions;
      setSuggestions(clips);
      setSelected(0);
      setPhase("results");
      if (videoRef.current && clips.length > 0) videoRef.current.currentTime = clips[0].start;
    } catch (e) {
      setError(`AI suggestion failed: ${toMsg(e)}`);
      setPhase("upload");
    }
  }

  function handleSelectSuggestion(i: number) {
    setSelected(i);
    if (videoRef.current) {
      videoRef.current.currentTime = suggestions[i].start;
      videoRef.current.pause();
    }
  }

  async function handleDownload(i: number) {
    if (!videoFile) return;
    setDownloading(i);
    try {
      const { start, end } = suggestions[i];
      const ffmpeg = await loadFfmpeg();

      if (!ffmpegRef.current) throw new Error("FFmpeg not loaded.");
      try { await ffmpeg.readFile("input.mp4"); } catch {
        await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));
      }

      await ffmpeg.exec([
        "-i", "input.mp4",
        "-ss", String(start),
        "-to", String(end),
        "-c", "copy",
        "clip.mp4",
      ]);
      const clipData = await ffmpeg.readFile("clip.mp4");
      const url = URL.createObjectURL(new Blob([(clipData as Uint8Array).buffer as ArrayBuffer], { type: "video/mp4" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${formatTime(start)}-${formatTime(end)}.mp4`.replace(/:/g, "-");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  function handleReset() {
    setPhase("upload");
    setVideoFile(null);
    setVideoUrl("");
    setSuggestions([]);
    setSelected(null);
    setError("");
  }

  const STEPS: { key: ProcessingStep; label: string }[] = [
    { key: "extracting", label: "Extracting audio…" },
    { key: "transcribing", label: "Transcribing speech…" },
    { key: "suggesting", label: "Finding best moments…" },
  ];
  const stepIndex = STEPS.findIndex((s) => s.key === processingStep);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">✂️</span>
          <h1 className="text-2xl font-bold text-white">Video Clipper</h1>
        </div>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Upload a video and AI will find the best moments to clip. Preview and download each clip instantly.
        </p>
      </div>

      {/* Setup note */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-6 text-xs text-zinc-500 leading-relaxed">
        <span className="text-zinc-400 font-medium">Setup required:</span> This tool needs a free{" "}
        <span className="text-violet-400 font-mono">GROQ_API_KEY</span> in{" "}
        <span className="font-mono">.env.local</span> for speech transcription.{" "}
        Get one free at <span className="text-zinc-400">console.groq.com</span> — 7,200 min/day free.
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Upload phase */}
      {phase === "upload" && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            onClick={() => document.getElementById("video-input")?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              dragOver ? "border-violet-500 bg-violet-500/5" : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            <input
              id="video-input"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {videoFile ? (
              <div>
                <p className="text-sm font-medium text-zinc-200">{videoFile.name}</p>
                <p className="text-xs text-zinc-500 mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-3">🎬</p>
                <p className="text-sm text-zinc-400">Drop a video here or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">MP4, MOV, WebM — max 500MB</p>
              </div>
            )}
          </div>

          {videoFile && (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-xl border border-zinc-800 bg-black max-h-64 object-contain"
              />
              <button
                onClick={handleProcess}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                ✨ Find Best Moments with AI
              </button>
            </>
          )}
        </div>
      )}

      {/* Processing phase */}
      {phase === "processing" && (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-200 mb-4">
              {STEPS[stepIndex]?.label}
            </p>
            <div className="flex items-center gap-2 justify-center">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    i < stepIndex ? "bg-violet-500" :
                    i === stepIndex ? "bg-violet-400 animate-pulse" :
                    "bg-zinc-700"
                  }`} />
                  {i < STEPS.length - 1 && <div className="w-6 h-px bg-zinc-800" />}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 justify-center">
              {STEPS.map((s, i) => (
                <p key={s.key} className={`text-xs ${i === stepIndex ? "text-zinc-400" : "text-zinc-700"}`}>
                  {s.label.replace("…", "")}
                </p>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-600 text-center max-w-xs">
            First run loads ffmpeg.wasm (~30MB). Subsequent clips are instant.
          </p>
        </div>
      )}

      {/* Results phase */}
      {phase === "results" && (
        <div className="flex flex-col gap-5">
          {/* Video preview */}
          <div>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full rounded-xl border border-zinc-800 bg-black max-h-72 object-contain"
            />
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              AI Suggestions — {suggestions.length} moments found
            </p>
            <div className="flex flex-col gap-3">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectSuggestion(i)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                    selected === i
                      ? "border-violet-500/60 bg-violet-500/5"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                          {formatTime(s.start)} – {formatTime(s.end)}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {Math.round(s.end - s.start)}s
                        </span>
                      </div>
                      <p className="text-sm font-medium text-zinc-200 mb-1">{s.reason}</p>
                      <p className="text-xs text-zinc-600 italic truncate">"{s.quote}"</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(i); }}
                      disabled={downloading !== null}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 transition-colors"
                    >
                      {downloading === i ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          Clipping…
                        </>
                      ) : (
                        "⬇ Download"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleReset}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors self-start"
          >
            ← Upload a different video
          </button>
        </div>
      )}
    </div>
  );
}
