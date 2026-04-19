import type { Metadata } from "next";
import PdfMerger from "@/components/PdfMerger";

export const metadata: Metadata = {
  title: "PDF Merger — Ganbaro",
  description:
    "Combine multiple PDF files into one. Reorder pages, merge, and download — all in your browser with no uploads to a server.",
  alternates: { canonical: "https://ganbaro.vercel.app/pdf-merger" },
};

export default function PdfMergerPage() {
  return <PdfMerger />;
}
