import type { Metadata } from "next";
import ChangeBackground from "@/components/ChangeBackground";

export const metadata: Metadata = {
  title: "Change Background — Ganbaro",
  description:
    "Replace an image background with a solid color directly in your browser. Great for ID photos, documents, and clean product shots.",
  alternates: { canonical: "https://ganbaro.vercel.app/change-background" },
};

export default function ChangeBackgroundPage() {
  return <ChangeBackground />;
}
