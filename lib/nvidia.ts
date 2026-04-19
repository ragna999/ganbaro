import OpenAI from "openai";

export const nvidia = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY!,
});

export const MODELS = {
  repoExplainer: "meta/llama-3.3-70b-instruct",
  docQA: "meta/llama-3.1-70b-instruct",
} as const;
