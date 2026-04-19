import type { Metadata } from "next";
import ImageToPdf from "@/components/ImageToPdf";

export const metadata: Metadata = {
  title: "Image to PDF — Ganbaro",
  description:
    "Combine multiple images into a single PDF file. Supports JPG, PNG, WebP, and GIF. Runs entirely in your browser — nothing is uploaded to a server.",
  alternates: { canonical: "https://ganbaro.vercel.app/image-to-pdf" },
};

export default function ImageToPdfPage() {
  return <ImageToPdf />;
}
