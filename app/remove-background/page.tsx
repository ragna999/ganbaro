import type { Metadata } from "next";
import RemoveBackground from "@/components/RemoveBackground";

export const metadata: Metadata = {
  title: "Remove Background — Ganbaro",
  description:
    "Remove the background from any image using AI. Free, no sign-up, runs entirely in your browser. Download as PNG.",
  alternates: { canonical: "https://ganbaro.vercel.app/remove-background" },
};

export default function RemoveBackgroundPage() {
  return <RemoveBackground />;
}
