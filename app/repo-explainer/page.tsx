import { Metadata } from "next";
import RepoExplainer from "@/components/RepoExplainer";

export const metadata: Metadata = {
  title: "Repo Explainer — Ganbaro",
  description: "Paste any public GitHub URL and AI will explain its architecture, tech stack, and key insights. Powered by NVIDIA NIM.",
  alternates: { canonical: "https://ganbaro.vercel.app/repo-explainer" },
};

export default function RepoExplainerPage() {
  return <RepoExplainer />;
}
