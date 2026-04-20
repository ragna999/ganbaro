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
            <footer className="border-t border-zinc-800/60 py-8 px-6">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
                <p>&copy; {new Date().getFullYear()} Ganbaro. Open source and free to use.</p>
                <div className="flex items-center gap-5">
                  <a
                    href="https://github.com/ragna999/ganbaro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-400 transition-colors"
                  >
                    GitHub
                  </a>
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
