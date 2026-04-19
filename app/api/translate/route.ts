import { NextRequest } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { text, targetLang } = await req.json();

  if (!text?.trim() || !targetLang) {
    return new Response("text and targetLang are required", { status: 400 });
  }

  const stream = await nvidia.chat.completions.create({
    model: MODELS.repoExplainer,
    messages: [
      {
        role: "user",
        content: `Translate the following text to ${targetLang}. Keep all code blocks, technical terms, and formatting (markdown headers, bold, lists) exactly as they are — only translate the natural language parts.\n\n${text}`,
      },
    ],
    stream: true,
    max_tokens: 2000,
    temperature: 0.2,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content ?? "";
          if (t) controller.enqueue(encoder.encode(t));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
