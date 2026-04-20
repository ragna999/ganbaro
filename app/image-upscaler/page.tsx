import type { Metadata } from "next";
import ImageUpscaler from "@/components/ImageUpscaler";

export const metadata: Metadata = {
  title: "Image Upscaler — Ganbaro",
  description:
    "Upscale images 2× or 4× using AI. Restore old photos or enhance low-resolution images. Free, runs entirely in your browser.",
  alternates: { canonical: "https://ganbaro.vercel.app/image-upscaler" },
};

export default function ImageUpscalerPage() {
  return <ImageUpscaler />;
}
