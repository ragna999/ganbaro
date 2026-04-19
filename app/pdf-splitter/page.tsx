import { Metadata } from "next";
import PdfSplitter from "@/components/PdfSplitter";

export const metadata: Metadata = {
  title: "PDF Splitter — Ganbaro",
  description: "Split large PDFs into smaller chunks directly in your browser. Choose pages per chunk. Great before running OCR.",
  alternates: { canonical: "https://ganbaro.vercel.app/pdf-splitter" },
};

export default function PdfSplitterPage() {
  return <PdfSplitter />;
}
