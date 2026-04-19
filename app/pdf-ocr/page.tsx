import { Metadata } from "next";
import PdfOcr from "@/components/PdfOcr";

export const metadata: Metadata = {
  title: "PDF OCR — Ganbaro",
  description: "Extract text from scanned PDFs using OCR. Download the result as a searchable text-based PDF. Max 50 pages.",
  alternates: { canonical: "https://ganbaro.vercel.app/pdf-ocr" },
};

export default function PdfOcrPage() {
  return <PdfOcr />;
}
