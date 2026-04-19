import { Metadata } from "next";
import AsciiArt from "@/components/AsciiArt";

export const metadata: Metadata = {
  title: "ASCII Art Generator — Ganbaro",
  description: "Convert any image into ASCII art using text characters. Choose character set, adjust width, invert colors, and download as PNG or JPG.",
  alternates: { canonical: "https://ganbaro.vercel.app/ascii-art" },
};

export default function AsciiArtPage() {
  return <AsciiArt />;
}
