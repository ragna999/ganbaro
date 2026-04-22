"use client";

import Link from "next/link";
import { useState } from "react";
import { tools, categoryColor } from "@/lib/tools";

const categories = ["All", "AI", "PDF", "Utility", "Fun"] as const;
type Category = (typeof categories)[number];

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered =
    activeCategory === "All" ? tools : tools.filter((t) => t.category === activeCategory);

  return (
    <div>
      {/* Hero */}
      <div className="relative text-center px-4 sm:px-6 pt-12 sm:pt-24 pb-10 sm:pb-16 overflow-hidden">
        {/* Background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-start justify-center"
        >
          <div className="w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-3xl mt-4" />
        </div>

        <div className="relative z-10">
          <div className="text-5xl mb-5 select-none">🔥</div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Ganbaro
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            A collection of open-source AI & utility tools.
            <br className="hidden sm:block" />
            Simple, fast, and free. No sign-up, no ads.
          </p>

          <div className="flex items-center justify-center gap-2.5 mt-6 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Powered by NVIDIA NIM
            </span>
            <span className="text-xs bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 px-3 py-1.5 rounded-full font-medium">
              Open Source
            </span>
            <span className="text-xs bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 px-3 py-1.5 rounded-full font-medium">
              Privacy Friendly
            </span>
          </div>
        </div>
      </div>

      {/* Tools grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        {/* Header + category filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
            Tools <span className="text-zinc-600 font-normal normal-case tracking-normal">({filtered.length} shown)</span>
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all duration-150 ${
                  activeCategory === cat
                    ? "bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/30"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tool) => (
            <Link
              key={tool.id}
              href={tool.path}
              className="group relative text-left bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{tool.icon}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {tool.beta && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Beta
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${categoryColor[tool.category]}`}>
                    {tool.category}
                  </span>
                </div>
              </div>
              <p className="text-sm font-semibold text-zinc-100 mb-1.5 group-hover:text-white transition-colors">
                {tool.label}
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
                {tool.desc}
              </p>
              <p className="text-xs text-violet-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Open tool →
              </p>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">No tools in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
