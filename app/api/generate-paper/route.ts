import { NextRequest, NextResponse } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

interface RefPaper {
  title: string;
  authors: string;
  year: number | null;
  doi: string | null;
}

async function fetchReferences(query: string, count: number): Promise<RefPaper[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(Math.min(count, 25)),
    select: "title,publication_year,authorships,doi",
    mailto: "yaumglyy@gmail.com",
  });

  try {
    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results ?? []).map((w: any): RefPaper => {
      const doi = w.doi ? w.doi.replace("https://doi.org/", "") : null;
      const authors = (w.authorships ?? [])
        .slice(0, 3)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => a.author?.display_name ?? "")
        .filter(Boolean);
      return {
        title: w.title ?? "Untitled",
        authors: authors.join(", ") || "Unknown",
        year: w.publication_year ?? null,
        doi,
      };
    });
  } catch {
    return [];
  }
}

function buildPrompt(
  title: string,
  language: string,
  refsContext: string,
  sectionName: string,
  sectionNumber: number,
  chunkIndex: number,
  totalChunks: number,
  wordTarget: number
): string {
  const partNote = totalChunks > 1 ? ` (Part ${chunkIndex + 1} of ${totalChunks})` : "";
  const isContinuation = chunkIndex > 0;

  const guides: Record<string, (i: number) => string> = {
    Abstract: () => "Write a concise summary covering: purpose, methods, key findings, and conclusions. Do not include a section header — start directly.",
    Introduction: () => "Cover: background and context, problem statement, research objectives, significance of the study, and paper structure overview.",
    "Literature Review": (i) =>
      i === 0
        ? "Review foundational and recent literature organized by theme. Identify key debates and research gaps."
        : "Continue the literature review with additional themes. Synthesize critically and connect to the research gap.",
    Methodology: () => "Describe: research design, data sources and collection, analytical methods, and methodological limitations.",
    "Results and Discussion": (i) =>
      i === 0
        ? "Present the main findings with evidence. Begin interpreting results in light of research objectives."
        : "Continue presenting and discussing findings. Compare with prior literature and discuss broader implications.",
    Conclusion: () => "Summarize key findings, restate contributions, acknowledge limitations, and propose future research directions.",
  };

  const guide = guides[sectionName]?.(chunkIndex) ?? "Write this section thoroughly and academically.";
  const continuationNote = isContinuation
    ? "\nThis is a continuation — do not repeat content from earlier parts. Continue naturally."
    : "";

  return `You are an expert academic writer writing a paper titled: "${title}"
Language: Write entirely in ${language}.
${refsContext}

Write ONLY the ${sectionName}${partNote} section. Target: approximately ${wordTarget} words.
${guide}
Use [n] in-text citations where appropriate. Do not include the section header in your output.${continuationNote}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Refs mode: fetch OpenAlex refs and return as JSON ──
  if (body.mode === "refs") {
    const { title, numRefs } = body;
    if (!title?.trim()) return NextResponse.json({ refs: [] });

    const refs = await fetchReferences(title.trim(), Math.min(numRefs ?? 10, 25));
    const formatted = refs.map(
      (r, i) =>
        `[${i + 1}] ${r.authors}. "${r.title}." ${r.year ?? "n.d."}${r.doi ? `. https://doi.org/${r.doi}` : ""}`
    );
    return NextResponse.json({ refs: formatted });
  }

  // ── Section mode: generate one chunk, stream text ──
  const { title, language, refs, sectionName, sectionNumber, chunkIndex, totalChunks, wordTarget } = body;
  if (!title?.trim() || !sectionName) {
    return new Response("Missing required fields", { status: 400 });
  }

  const refsContext =
    Array.isArray(refs) && refs.length > 0
      ? `Use these real references — cite with [n] notation:\n${refs.join("\n")}`
      : "Generate plausible academic citations inline.";

  const prompt = buildPrompt(
    title, language ?? "English", refsContext,
    sectionName, sectionNumber, chunkIndex ?? 0, totalChunks ?? 1, wordTarget ?? 1000
  );

  const maxTokens = Math.min(Math.ceil((wordTarget ?? 1000) * 1.5) + 200, 3500);

  const stream = await nvidia.chat.completions.create({
    model: MODELS.paperGenerator,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: maxTokens,
    temperature: 0.55,
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
