import type { Metadata } from "next";
import PaperFinder from "@/components/PaperFinder";

export const metadata: Metadata = {
  title: "Paper Finder — Ganbaro",
  description:
    "Search millions of academic papers and get AI-powered explanations of any research. Powered by Semantic Scholar.",
  alternates: { canonical: "https://ganbaro.vercel.app/paper-finder" },
};

export default function PaperFinderPage() {
  return <PaperFinder />;
}
