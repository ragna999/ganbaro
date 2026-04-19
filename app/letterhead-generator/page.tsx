import type { Metadata } from "next";
import LetterheadGenerator from "@/components/LetterheadGenerator";

export const metadata: Metadata = {
  title: "Letterhead Generator — Ganbaro",
  description:
    "Create a professional company letterhead in seconds. Add your logo, contact info, and brand color. Download as PDF — free and private.",
  alternates: { canonical: "https://ganbaro.vercel.app/letterhead-generator" },
};

export default function LetterheadGeneratorPage() {
  return <LetterheadGenerator />;
}
