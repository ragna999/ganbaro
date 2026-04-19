import { Metadata } from "next";
import PdfReader from "@/components/PdfReader";

export const metadata: Metadata = {
  title: "PDF Reader — Ganbaro",
  description: "Upload a text-based PDF and listen to it read aloud in your browser. Adjust speed and voice. Uses the Web Speech API.",
  alternates: { canonical: "https://ganbaro.vercel.app/pdf-reader" },
};

export default function PdfReaderPage() {
  return <PdfReader />;
}
