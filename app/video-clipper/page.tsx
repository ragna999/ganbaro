import type { Metadata } from "next";
import VideoClipper from "@/components/VideoClipper";

export const metadata: Metadata = {
  title: "Video Clipper — Ganbaro",
  description:
    "Upload a video and let AI find the best moments to clip. Preview and download each clip instantly. Runs in your browser.",
  alternates: { canonical: "https://ganbaro.vercel.app/video-clipper" },
};

export default function VideoClipperPage() {
  return <VideoClipper />;
}
