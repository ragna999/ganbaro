import type { Metadata } from "next";
import WatermarkPdf from "@/components/WatermarkPdf";

export const metadata: Metadata = {
  title: "Watermark PDF — Ganbaro",
  description:
    "Add a text watermark to every page of a PDF. Choose opacity, angle, and layout. Runs entirely in your browser.",
  alternates: { canonical: "https://ganbaro.vercel.app/watermark-pdf" },
};

export default function WatermarkPdfPage() {
  return <WatermarkPdf />;
}
