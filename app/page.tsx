"use client";

import { useState, useRef, useEffect } from "react";
import RepoExplainer from "@/components/RepoExplainer";
import DocQA from "@/components/DocQA";
import PdfReader from "@/components/PdfReader";
import PdfSplitter from "@/components/PdfSplitter";
import PdfOcr from "@/components/PdfOcr";
import AsciiArt from "@/components/AsciiArt";
import FileCompressor from "@/components/FileCompressor";

type Tool = "repo" | "doc" | "reader" | "splitter" | "ocr" | "ascii" | "compress";

const tools: { id: Tool; icon: string; label: string; desc: string; category: string }[] = [
  { id: "repo",     icon: "⚡", label: "Repo Explainer",  desc: "Explain any public GitHub repo — architecture, tech stack, and key insights.",    category: "AI"      },
  { id: "doc",      icon: "📄", label: "Doc Q&A",         desc: "Upload a PDF and ask anything about its content. Powered by AI.",                 category: "AI"      },
  { id: "reader",   icon: "🎧", label: "PDF Reader",      desc: "Listen to any text-based PDF read aloud. Adjust speed and voice.",                category: "PDF"     },
  { id: "splitter", icon: "✂️", label: "PDF Splitter",    desc: "Split large PDFs into smaller chunks. Great before running OCR.",                 category: "PDF"     },
  { id: "ocr",      icon: "🔍", label: "PDF OCR",         desc: "Extract text from scanned PDFs. Output as a text-based PDF. Max 50 pages.",       category: "PDF"     },
  { id: "ascii",    icon: "🖼️", label: "ASCII Art",       desc: "Convert any image into ASCII art. Download as PNG or JPG.",                       category: "Fun"     },
  { id: "compress", icon: "📦", label: "File Compressor", desc: "Compress images, PDFs, and DOCX files locally — nothing is uploaded to a server.", category: "Utility" },
];

const faqItems = [
  {
    tool: "⚡ Repo Explainer",
    q: "Apa itu Repo Explainer?",
    a: "Paste URL repo GitHub mana saja, dan AI akan menjelaskan arsitektur, tech stack, cara kerja, dan insight menarik dari kodebase tersebut. Cocok untuk developer yang ingin memahami project baru dengan cepat.",
  },
  {
    tool: "📄 Doc Q&A",
    a: "Upload file PDF — bisa paper, buku, manual, laporan — lalu tanya apa saja tentang isinya. AI akan menjawab berdasarkan konten dokumen.",
    q: "Apa itu Doc Q&A?",
  },
  {
    tool: "🎧 PDF Reader",
    q: "Apa itu PDF Reader?",
    a: "Upload PDF teks, dan browser akan membacakannya keras-keras. Bisa atur kecepatan, pilih suara, dan lompat ke paragraf manapun. Ideal untuk belajar sambil melakukan hal lain.",
  },
  {
    tool: "✂️ PDF Splitter",
    q: "Apa itu PDF Splitter?",
    a: "Pecah PDF besar menjadi beberapa bagian dengan jumlah halaman yang bisa kamu tentukan. Berguna sebelum menggunakan PDF OCR yang punya batas 50 halaman.",
  },
  {
    tool: "🔍 PDF OCR",
    q: "Apa itu PDF OCR?",
    a: "Upload PDF hasil scan (foto halaman buku/dokumen), dan tool ini akan mengekstrak teksnya menggunakan OCR. Hasilnya bisa didownload sebagai PDF teks yang bisa digunakan di PDF Reader atau Doc Q&A. Maks 50 halaman — gunakan PDF Splitter terlebih dahulu untuk file besar.",
  },
  {
    tool: "🖼️ ASCII Art",
    q: "Apa itu ASCII Art?",
    a: "Upload gambar apa saja dan konversi menjadi ASCII art menggunakan karakter teks. Bisa pilih character set, atur lebar, invert warna, dan download hasilnya sebagai PNG atau JPG.",
  },
  {
    tool: "📦 File Compressor",
    q: "Apa itu File Compressor?",
    a: "Kompres gambar (JPG/PNG/WebP), PDF, atau DOCX langsung di browser — tanpa upload ke server. Cocok untuk mahasiswa yang perlu mengecilkan ukuran file sebelum upload ke portal kampus. Gambar bisa dihemat hingga 80%.",
  },
];

function ToolsDropdown({ active, onSelect }: { active: Tool; onSelect: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = tools.find((t) => t.id === active)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-zinc-100 text-sm font-medium"
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-1.5">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => { onSelect(tool.id); setOpen(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  active === tool.id
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span className="text-base w-5 text-center">{tool.icon}</span>
                <div>
                  <p className="text-sm font-medium leading-none mb-0.5">{tool.label}</p>
                  <p className={`text-xs ${active === tool.id ? "text-violet-200" : "text-zinc-600"}`}>
                    {tool.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FaqModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">FAQ</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Penjelasan singkat tiap tool di Ganbaro</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-5">
          {faqItems.map((item, i) => (
            <div key={i} className="border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-400 mb-1">{item.tool}</p>
              <p className="text-sm font-medium text-zinc-200 mb-1.5">{item.q}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const categoryColor: Record<string, string> = {
  AI:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  PDF:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Utility: "bg-green-500/10 text-green-400 border-green-500/20",
  Fun:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function HomePage({ onSelect }: { onSelect: (t: Tool) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="text-center px-6 pt-20 pb-14">
        <div className="text-6xl mb-5">🔥</div>
        <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">
          Ganbaro
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
          Kumpulan tools open-source berbasis AI & utility yang simpel, cepat, dan gratis.
          Tidak perlu sign-up, tidak ada iklan.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          <span className="text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-full">
            Powered by NVIDIA NIM
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-full">
            Open Source
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-full">
            Privacy Friendly
          </span>
        </div>
      </div>

      {/* Tools grid */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-5">
          Tools — {tools.length} tersedia
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onSelect(tool.id)}
              className="group text-left bg-zinc-900 border border-zinc-800 hover:border-violet-500/60 hover:bg-zinc-800/80 rounded-2xl p-5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{tool.icon}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${categoryColor[tool.category]}`}>
                  {tool.category}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-100 mb-1.5 group-hover:text-white">
                {tool.label}
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400">
                {tool.desc}
              </p>
              <p className="text-xs text-violet-500 mt-3 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Buka tool →
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState<Tool | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Navbar */}
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 h-14">
          {/* Brand */}
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl">🔥</span>
            <div className="text-left">
              <span className="text-base font-bold text-white tracking-tight">Ganbaro</span>
              <span className="text-xs text-zinc-600 ml-2 hidden sm:inline">Open-source AI tools</span>
            </div>
          </button>

          {/* Nav items */}
          <nav className="flex items-center gap-1">
            {active && <ToolsDropdown active={active} onSelect={setActive} />}

            <button
              onClick={() => setFaqOpen(true)}
              className="px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100 text-sm font-medium"
            >
              FAQ
            </button>

            <a
              href="https://buymeacoffee.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-sm font-semibold transition-colors"
            >
              <span>☕</span>
              <span className="hidden sm:inline">Buy me a coffee</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {!active             ? <HomePage onSelect={setActive} />  :
         active === "repo"   ? <RepoExplainer />                  :
         active === "doc"    ? <DocQA />                          :
         active === "reader" ? <PdfReader />                      :
         active === "splitter" ? <PdfSplitter />                  :
         active === "ocr"    ? <PdfOcr />                         :
         active === "ascii"  ? <AsciiArt />                       :
                               <FileCompressor />}
      </main>

      {/* FAQ Modal */}
      {faqOpen && <FaqModal onClose={() => setFaqOpen(false)} />}
    </div>
  );
}
