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
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
