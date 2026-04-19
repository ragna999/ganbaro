import { Metadata } from "next";
import FileCompressor from "@/components/FileCompressor";

export const metadata: Metadata = {
  title: "File Compressor — Ganbaro",
  description: "Compress images (JPG/PNG/WebP), PDFs, and DOCX files directly in your browser. Nothing is uploaded to a server. Images can be reduced by up to 80%.",
  alternates: { canonical: "https://ganbaro.vercel.app/file-compressor" },
};

export default function FileCompressorPage() {
  return <FileCompressor />;
}
