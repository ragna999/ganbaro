import { Metadata } from "next";
import PdfToImage from "@/components/PdfToImage";

export const metadata: Metadata = {
  title: "PDF to Image — Ganbaro",
  description: "Convert PDF pages to PNG or JPEG images directly in your browser. Choose page range and render scale.",
  alternates: { canonical: "https://ganbaro.vercel.app/pdf-to-image" },
};

export default function PdfToImagePage() {
  return <PdfToImage />;
}
