import { NextRequest } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { question, context, history } = (await req.json()) as {
    question: string;
    context: string;
    history: Message[];
  };

  if (!question?.trim()) {
    return new Response("Question is required", { status: 400 });
  }

  const systemContent = context?.trim()
    ? `You are a helpful AI assistant that answers questions based on the provided document. Be accurate and concise. Cite relevant parts of the document when helpful. If the answer is not in the document, say so clearly.

<document>
${context}
</document>`
    : "You are a helpful AI assistant. Answer questions accurately and concisely.";

  const messages = [
    { role: "system" as const, content: systemContent },
    ...(history ?? []),
    { role: "user" as const, content: question },
  ];

  const stream = await nvidia.chat.completions.create({
    model: MODELS.docQA,
    messages,
    stream: true,
    max_tokens: 1000,
    temperature: 0.2,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
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
