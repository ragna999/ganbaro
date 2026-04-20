import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "groq-sdk"],
  transpilePackages: ["upscaler", "upscalerjs", "@upscalerjs/esrgan-slim"],
};

export default nextConfig;
