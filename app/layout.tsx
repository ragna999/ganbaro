import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ganbaro — Free AI & Utility Tools",
  description:
    "Open-source tools to compress files, explain GitHub repos, read PDFs aloud, extract text with OCR, convert images to ASCII art, and more. No sign-up, no ads, nothing uploaded to a server.",
  keywords: [
    "file compressor", "pdf compressor", "image compressor", "docx compressor",
    "pdf ocr", "ocr online", "pdf splitter", "pdf reader", "repo explainer",
    "github repo explainer", "doc qa", "ascii art generator", "ai tools", "free tools",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
