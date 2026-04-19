"use client";

import Link from "next/link";
import { tools, categoryColor } from "@/lib/tools";

export default function HomePage() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="text-center px-6 pt-20 pb-14">
        <div className="text-6xl mb-5">🔥</div>
        <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">
          Ganbaro
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
          A collection of open-source AI & utility tools — simple, fast, and free.
          No sign-up, no ads.
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
          Tools — {tools.length} available
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.path}
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
                Open tool →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
