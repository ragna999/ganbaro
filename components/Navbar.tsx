"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tools, faqItems } from "@/lib/tools";

function ToolsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = tools.find((t) => t.path === pathname);
  if (!current) return null;

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
        <div className="absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-1.5 max-h-[60vh] overflow-y-auto">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => { router.push(tool.path); setOpen(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  pathname === tool.path
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span className="text-base w-5 text-center">{tool.icon}</span>
                <div>
                  <p className="text-sm font-medium leading-none mb-0.5">{tool.label}</p>
                  <p className={`text-xs ${pathname === tool.path ? "text-violet-200" : "text-zinc-600"}`}>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">FAQ</h2>
            <p className="text-xs text-zinc-500 mt-0.5">A quick overview of each tool in Ganbaro</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors text-lg"
          >
            ×
          </button>
        </div>
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

export default function Navbar() {
  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <>
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 h-14">
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl">🔥</span>
            <div className="text-left">
              <span className="text-base font-bold text-white tracking-tight">Ganbaro</span>
              <span className="text-xs text-zinc-600 ml-2 hidden sm:inline">Open-source AI tools</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <ToolsDropdown />

            <button
              onClick={() => setFaqOpen(true)}
              className="px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100 text-sm font-medium"
            >
              FAQ
            </button>

            <a
              href="https://github.com/ragna999/ganbaro"
              target="_blank"
              rel="noopener noreferrer"
              title="View on GitHub"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-100"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5 w-[18px] h-[18px]">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.031 1.531 1.031.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </nav>
        </div>
      </header>

      {faqOpen && <FaqModal onClose={() => setFaqOpen(false)} />}
    </>
  );
}
