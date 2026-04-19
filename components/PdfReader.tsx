"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DocInfo {
  text: string;
  pages: number;
  fileName: string;
  truncated: boolean;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

export default function PdfReader() {
  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPara, setCurrentPara] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const isPlayingRef = useRef(false);
  const currentParaRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef("");

  // Sync refs with state
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);

  // Load voices
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0) return;
      setVoices(v);
      const def = v.find((x) => x.lang.startsWith("en")) ?? v[0];
      setSelectedVoice((prev) => prev || def.name);
      voiceRef.current = voiceRef.current || def.name;
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Parse paragraphs
  useEffect(() => {
    if (!docInfo) return;

    let paras: string[] = [];

    // Try splitting by double newlines first (proper paragraphs)
    const byDoubleNewline = docInfo.text
      .split(/\n{2,}/)
      .map((b) => b.replace(/\n/g, " ").trim())
      .filter((p) => p.length > 20);

    if (byDoubleNewline.length > 5) {
      paras = byDoubleNewline;
    } else {
      // Fallback: split by single newlines (common in PDF extractions)
      paras = docInfo.text
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 20);
    }

    setParagraphs(paras);
    setCurrentPara(0);
    currentParaRef.current = 0;
  }, [docInfo]);

  // Scroll current paragraph into view
  useEffect(() => {
    paraRefs.current[currentPara]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentPara]);

  // Cleanup on unmount
  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  const speakFrom = useCallback(
    (index: number) => {
      if (index >= paragraphs.length) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentPara(0);
        currentParaRef.current = 0;
        return;
      }

      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(paragraphs[index]);
      utter.rate = rateRef.current;
      const voice = window.speechSynthesis.getVoices().find((v) => v.name === voiceRef.current);
      if (voice) utter.voice = voice;

      utter.onend = () => {
        if (!isPlayingRef.current) return;
        const next = currentParaRef.current + 1;
        currentParaRef.current = next;
        setCurrentPara(next);
        speakFrom(next);
      };

      utter.onerror = (e) => {
        if (e.error === "interrupted") return;
        setIsPlaying(false);
        isPlayingRef.current = false;
      };

      window.speechSynthesis.speak(utter);
    },
    [paragraphs]
  );

  function togglePlay() {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      speakFrom(currentParaRef.current);
    }
  }

  function handleStop() {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentPara(0);
    currentParaRef.current = 0;
  }

  function jumpTo(index: number) {
    const target = Math.max(0, Math.min(index, paragraphs.length - 1));
    currentParaRef.current = target;
    setCurrentPara(target);
    if (isPlaying) speakFrom(target);
  }

  function handleRateChange(newRate: number) {
    setRate(newRate);
    rateRef.current = newRate;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setTimeout(() => speakFrom(currentParaRef.current), 50);
    }
  }

  async function handleFileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
      return;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setUploading(true);
    setError("");
    setDocInfo(null);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to process PDF"); return; }
      setDocInfo(data);
    } catch {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto"><div className="flex flex-col p-4 sm:p-8 sm:h-full">
      {/* Header */}
      <div className="mb-4 sm:mb-5 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-100">PDF Reader</h2>
        <p className="text-zinc-500 mt-1 text-sm">Upload a PDF and listen to it read aloud.</p>
        <span className="inline-block mt-2 text-xs bg-zinc-800/80 text-zinc-500 px-2.5 py-1 rounded-md">
          Web Speech API
        </span>
      </div>

      {!docInfo ? (
        /* Upload */
        <div className="flex-1 flex items-center justify-center">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            onDragOver={(e) => e.preventDefault()}
            className="w-full max-w-sm border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-2xl p-12 text-center cursor-pointer transition-colors group"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Processing PDF…</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🎧</div>
                <p className="text-zinc-300 font-medium mb-1">Drop your PDF here</p>
                <p className="text-zinc-600 text-sm">or click to browse</p>
                {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                <p className="text-zinc-700 text-xs mt-3">PDF only · Max ~4 MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
          />
        </div>
      ) : (
        <>
          {/* File info */}
          <div className="shrink-0 flex items-center justify-between mb-4 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-lg">📄</span>
              <div>
                <p className="text-sm font-medium text-zinc-200 leading-none mb-0.5">{docInfo.fileName}</p>
                <p className="text-xs text-zinc-500">
                  {docInfo.pages} page{docInfo.pages !== 1 ? "s" : ""} · {paragraphs.length} paragraphs
                  {docInfo.truncated && " · Truncated to ~250 pages"}
                </p>
                {paragraphs.length === 0 && (
                  <p className="text-xs text-red-400">Could not parse paragraphs. Text extracted: {docInfo.text.length} chars</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { handleStop(); setDocInfo(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Change file
            </button>
          </div>

          {/* Text display */}
          <div className="min-h-[250px] sm:flex-1 sm:min-h-0 overflow-y-auto mb-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
            {paragraphs.map((para, i) => (
              <p
                key={i}
                ref={(el) => { paraRefs.current[i] = el; }}
                onClick={() => jumpTo(i)}
                className={`text-sm leading-relaxed cursor-pointer rounded-lg px-3 py-2 transition-all duration-200 ${
                  i === currentPara
                    ? "bg-violet-600/20 text-zinc-100 border-l-2 border-violet-500"
                    : i < currentPara
                    ? "text-zinc-600 hover:text-zinc-400"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                {para}
              </p>
            ))}
          </div>

          {/* Controls */}
          <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Paragraph {Math.min(currentPara + 1, paragraphs.length)} of {paragraphs.length}</span>
              <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${((currentPara + 1) / paragraphs.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Playback buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => jumpTo(currentPara - 1)}
                disabled={currentPara === 0}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-300"
                title="Previous paragraph"
              >
                ⏮
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 transition-colors text-white text-xl"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button
                onClick={handleStop}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300"
                title="Stop"
              >
                ⏹
              </button>
              <button
                onClick={() => jumpTo(currentPara + 1)}
                disabled={currentPara >= paragraphs.length - 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-300"
                title="Next paragraph"
              >
                ⏭
              </button>
            </div>

            {/* Speed + Voice */}
            <div className="flex items-center justify-between gap-4">
              {/* Speed */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500 mr-1">Speed</span>
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRateChange(r)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      rate === r
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>

              {/* Voice */}
              {voices.length > 0 && (
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 max-w-[180px] truncate"
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </>
      )}
    </div></div>
  );
}
