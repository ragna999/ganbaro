import { NextRequest } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { title, abstract, authors, year } = await req.json();

  if (!title) return new Response("Missing title", { status: 400 });
  if (!abstract) return new Response("No abstract available for this paper.", { status: 400 });

  const authorsStr = Array.isArray(authors) && authors.length
    ? authors.slice(0, 5).map((a: { name: string }) => a.name).join(", ")
    : "Unknown";

  const prompt = `You are a research assistant helping a student or researcher understand an academic paper.

## Paper
**Title:** ${title}
**Authors:** ${authorsStr}${year ? `\n**Year:** ${year}` : ""}

**Abstract:**
${abstract}

Explain this paper in a clear, accessible way. Structure your response as:

1. **What It's About** — The core problem or question the paper addresses
2. **Key Findings** — The main results or contributions
3. **Methods** — How they did it (briefly)
4. **Why It Matters** — Real-world relevance or impact
5. **Who Should Read This** — What kind of researcher or student would benefit most

Keep it concise and jargon-free where possible.`;

  const stream = await nvidia.chat.completions.create({
    model: MODELS.repoExplainer,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: 1000,
    temperature: 0.3,
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
