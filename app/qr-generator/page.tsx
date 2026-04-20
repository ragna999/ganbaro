import type { Metadata } from "next";
import QrGenerator from "@/components/QrGenerator";

export const metadata: Metadata = {
  title: "QR Code Generator — Ganbaro",
  description:
    "Generate QR codes from any URL or text for free. Customize size, colors, and error correction. Download as PNG. No sign-up, runs in your browser.",
  alternates: { canonical: "https://ganbaro.vercel.app/qr-generator" },
};

export default function QrGeneratorPage() {
  return <QrGenerator />;
}
