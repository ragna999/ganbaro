import { MetadataRoute } from "next";

const BASE = "https://ganbaro.vercel.app";

const pages = [
  { path: "/",                priority: 1.0 },
  { path: "/repo-explainer",  priority: 0.8 },
  { path: "/doc-qa",          priority: 0.8 },
  { path: "/pdf-reader",      priority: 0.8 },
  { path: "/pdf-splitter",    priority: 0.8 },
  { path: "/pdf-ocr",         priority: 0.8 },
  { path: "/ascii-art",       priority: 0.8 },
  { path: "/file-compressor", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  }));
}
