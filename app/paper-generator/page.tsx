import type { Metadata } from "next";
import PaperGenerator from "@/components/PaperGenerator";

export const metadata: Metadata = {
  title: "Paper Generator — Ganbaro",
  description:
    "Generate a full academic paper from just a title. Choose page count, number of references, and language. References sourced from OpenAlex.",
  alternates: { canonical: "https://ganbaro.vercel.app/paper-generator" },
};

export default function PaperGeneratorPage() {
  return <PaperGenerator />;
}
