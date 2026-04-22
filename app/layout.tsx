import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ganbaro — Free AI & Utility Tools",
  description:
    "Open-source tools to compress files, explain GitHub repos, read PDFs aloud, extract text with OCR, convert images to ASCII art, and more. No sign-up, no ads, nothing uploaded to a server.",
  keywords: [
    "file compressor", "pdf compressor", "image compressor", "docx compressor",
    "pdf ocr", "ocr online", "pdf splitter", "pdf reader", "pdf merger",
    "watermark pdf", "image to pdf", "invoice generator", "letterhead generator",
    "repo explainer", "github repo explainer", "doc qa", "ascii art generator",
    "paper finder", "academic paper search", "research paper ai", "semantic scholar",
    "ai tools", "free tools", "online pdf tools", "free invoice maker",
  ],
  metadataBase: new URL("https://ganbaro.vercel.app"),
  openGraph: {
    title: "Ganbaro — Free AI & Utility Tools",
    description:
      "Open-source tools to compress files, explain GitHub repos, read PDFs aloud, extract text with OCR, and more. No sign-up, no ads.",
    url: "https://ganbaro.vercel.app",
    siteName: "Ganbaro",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Ganbaro — Free AI & Utility Tools",
    description:
      "Open-source tools to compress files, explain GitHub repos, read PDFs aloud, extract text with OCR, and more.",
  },
  alternates: {
    canonical: "https://ganbaro.vercel.app",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
          <Navbar />
          <div className="flex-1 overflow-y-auto">
            <main>{children}</main>
            <footer className="border-t border-zinc-800/50 py-8 px-6 mt-4">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
                <p>
                  &copy; {new Date().getFullYear()}{" "}
                  <span className="text-zinc-500 font-medium">Ganbaro</span>
                  {" — "}Open source and free to use.
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href="https://github.com/ragna999/ganbaro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.031 1.531 1.031.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" />
                    </svg>
                    GitHub
                  </a>
                  <span className="text-zinc-800">|</span>
                  <a
                    href="https://teer.id/gimly"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Buy me a coffee ☕
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
