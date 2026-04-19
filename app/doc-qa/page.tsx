import { Metadata } from "next";
import DocQA from "@/components/DocQA";

export const metadata: Metadata = {
  title: "Doc Q&A — Ganbaro",
  description: "Upload a PDF and ask anything about its content. AI will answer based on the document. Powered by NVIDIA NIM.",
  alternates: { canonical: "https://ganbaro.vercel.app/doc-qa" },
};

export default function DocQAPage() {
  return <DocQA />;
}
