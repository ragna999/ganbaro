import type { Metadata } from "next";
import VideoSplitter from "@/components/VideoSplitter";

export const metadata: Metadata = {
  title: "Video Splitter — Ganbaro",
  description:
    "Split long videos into smaller chunks by duration. Choose 5, 10, 15, or 30-minute parts. Runs entirely in your browser.",
  alternates: { canonical: "https://ganbaro.vercel.app/video-splitter" },
};

export default function VideoSplitterPage() {
  return <VideoSplitter />;
}
