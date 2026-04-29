import { NextRequest, NextResponse } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

interface RefPaper {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
}

// "Ahmad Yusuf Alfaruq" → "Alfaruq, A. Y."
function toApaAuthor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Unknown";
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => p[0].toUpperCase() + ".").join(" ");
  return `${lastName}, ${initials}`;
}

function formatApaEntry(ref: RefPaper, index: number): string {
  const authorStr =
    ref.authors.length === 0
      ? "Unknown"
      : ref.authors.length === 1
      ? toApaAuthor(ref.authors[0])
      : ref.authors.length === 2
      ? `${toApaAuthor(ref.authors[0])}, & ${toApaAuthor(ref.authors[1])}`
      : `${toApaAuthor(ref.authors[0])}, et al.`;

  const year = ref.year ? `(${ref.year})` : "(n.d.)";
  const doi = ref.doi ? ` https://doi.org/${ref.doi}` : "";

  return `${index + 1}. ${authorStr} ${year}. ${ref.title}.${doi}`;
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
        authors,
        year: w.publication_year ?? null,
        doi,
      };
    });
  } catch {
    return [];
  }
}

// Localized section names for the AI prompt
const LOCALIZED_SECTIONS: Record<string, Record<string, string>> = {
  Indonesian: {
    Abstract: "Abstrak",
    Introduction: "Pendahuluan",
    "Literature Review": "Tinjauan Pustaka",
    Methodology: "Metodologi Penelitian",
    "Results and Discussion": "Hasil dan Pembahasan",
    Conclusion: "Penutup",
    References: "Daftar Pustaka",
  },
  Spanish: {
    Abstract: "Resumen",
    Introduction: "Introducción",
    "Literature Review": "Revisión de Literatura",
    Methodology: "Metodología",
    "Results and Discussion": "Resultados y Discusión",
    Conclusion: "Conclusión",
    References: "Referencias",
  },
  French: {
    Abstract: "Résumé",
    Introduction: "Introduction",
    "Literature Review": "Revue de Littérature",
    Methodology: "Méthodologie",
    "Results and Discussion": "Résultats et Discussion",
    Conclusion: "Conclusion",
    References: "Références",
  },
  German: {
    Abstract: "Zusammenfassung",
    Introduction: "Einleitung",
    "Literature Review": "Literaturüberblick",
    Methodology: "Methodik",
    "Results and Discussion": "Ergebnisse und Diskussion",
    Conclusion: "Fazit",
    References: "Literaturverzeichnis",
  },
  Portuguese: {
    Abstract: "Resumo",
    Introduction: "Introdução",
    "Literature Review": "Revisão de Literatura",
    Methodology: "Metodologia",
    "Results and Discussion": "Resultados e Discussão",
    Conclusion: "Conclusão",
    References: "Referências",
  },
};

function localizeSection(sectionName: string, language: string): string {
  return LOCALIZED_SECTIONS[language]?.[sectionName] ?? sectionName;
}

// Per-section citation rules — controls the CITATION STYLE line in the prompt
const CITATION_RULES: Record<string, string> = {
  Abstract:
    "Do NOT use any in-text citations in the abstract. Write from the paper's own findings.",
  Introduction:
    "Use APA in-text citations (Author, Year) to support background claims and to justify the research gap. Cite only where the claim genuinely needs external support — not every sentence.",
  "Literature Review":
    "Use APA in-text citations (Author, Year) extensively. Every claim about prior work must be attributed. Synthesize multiple sources per paragraph where possible.",
  Methodology:
    "Use APA in-text citations (Author, Year) only when justifying your choice of research design or analytical framework (e.g. citing the methodologist who defined the approach). Do not cite for describing your own data collection steps.",
  "Results and Discussion":
    "Use APA in-text citations (Author, Year) only when comparing or contrasting your findings with prior literature. Your own results and observations do not need citations.",
  Conclusion:
    "Do NOT use in-text citations. The conclusion summarizes your own findings and contributions. Write entirely from the paper's own results.",
};

// Section-specific writing guides
const SECTION_GUIDES: Record<string, (lang: string, chunk: number, total: number) => string> = {
  Abstract: () =>
    "Write a structured abstract covering: research background and problem, objectives, methodology used, key findings, and conclusions/implications. Be precise and informative.",
  Introduction: () =>
    "Write a comprehensive introduction covering: (1) research background and context, (2) identification of the problem and research gap supported by literature, (3) research objectives and questions, (4) significance and contribution of the study, (5) brief overview of the paper structure.",
  "Literature Review": (_, chunk, total) =>
    chunk === 0
      ? "Write a thorough literature review. For each referenced work, discuss its methodology, findings, and contribution to the field in detail. Organize thematically. Critically analyze and synthesize sources — do not merely list them. Identify debates, contradictions, and gaps. Minimum 2 full paragraphs per theme."
      : `Continue the literature review (part ${chunk + 1} of ${total}). Introduce new themes or perspectives not yet covered. Synthesize multiple sources per paragraph. End by connecting the gaps to your research objectives.`,
  Methodology: () =>
    "Write a detailed methodology section covering: (1) research design and paradigm (qualitative/quantitative/mixed) with justification, (2) data sources and collection methods in detail, (3) analytical framework or instruments used, (4) validity and reliability measures, (5) limitations of the methodology.",
  "Results and Discussion": (_, chunk, total) =>
    chunk === 0
      ? "Present and discuss the main findings in depth. For each finding: present the evidence, interpret its meaning, connect it to the research objectives. Where relevant, compare with prior literature. Use detailed paragraphs, not bullet points."
      : `Continue the results and discussion (part ${chunk + 1} of ${total}). Present additional findings and their implications. Compare and contrast with existing literature where relevant. Discuss theoretical and practical implications in depth.`,
  Conclusion: () =>
    "Write a comprehensive conclusion covering: (1) restatement of research objectives, (2) summary of key findings and their significance, (3) theoretical and practical contributions, (4) limitations of the study, (5) directions for future research. Write entirely from the paper's own findings.",
};

function buildPrompt(
  title: string,
  language: string,
  refsContext: string,
  sectionName: string,
  chunkIndex: number,
  totalChunks: number,
  wordTarget: number
): string {
  const localName = localizeSection(sectionName, language);
  const partNote = totalChunks > 1 ? ` (Part ${chunkIndex + 1} of ${totalChunks})` : "";
  const guide = SECTION_GUIDES[sectionName]?.(language, chunkIndex, totalChunks) ?? "Write this section thoroughly and academically.";
  const citationRule = CITATION_RULES[sectionName] ?? "Use APA in-text citations (Author, Year) where appropriate.";
  const continuationNote =
    chunkIndex > 0
      ? "\nThis is a continuation — do not repeat content from previous parts. Continue naturally and coherently."
      : "";

  return `You are an expert academic writer. You are writing a section of a formal academic paper.

PAPER TITLE: "${title}"
LANGUAGE: Write entirely in ${language}. Use formal academic ${language}.
SECTION: ${localName}${partNote}

${refsContext}

TASK: Write ONLY the body text of the ${localName} section${partNote}. Do NOT include the section heading.
${continuationNote}

CONTENT GUIDE:
${guide}

WORD COUNT: This section MUST be at least ${wordTarget} words long. Write in full, dense academic paragraphs. Be thorough and detailed — do not stop early.

CITATION RULE: ${citationRule}

FORMATTING: Write in continuous prose paragraphs. No bullet points. No subheadings unless academically appropriate.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Refs mode ──
  if (body.mode === "refs") {
    const { title, numRefs } = body;
    if (!title?.trim()) return NextResponse.json({ bibliography: [], citationContext: "" });

    const rawRefs = await fetchReferences(title.trim(), Math.min(numRefs ?? 10, 25));

    const bibliography = rawRefs.map((r, i) => formatApaEntry(r, i));

    // Context string passed into every section prompt
    const citationContext =
      bibliography.length > 0
        ? `AVAILABLE REFERENCES (cite in-text as (LastName, Year)):\n${bibliography.join("\n")}`
        : "Generate plausible APA-style citations inline where appropriate.";

    return NextResponse.json({ bibliography, citationContext });
  }

  // ── Section mode ──
  const {
    title, language, citationContext,
    sectionName, chunkIndex, totalChunks, wordTarget,
  } = body;

  if (!title?.trim() || !sectionName) {
    return new Response("Missing required fields", { status: 400 });
  }

  const refsCtx = citationContext ?? "Generate plausible APA-style citations inline where appropriate.";

  const prompt = buildPrompt(
    title, language ?? "English", refsCtx,
    sectionName, chunkIndex ?? 0, totalChunks ?? 1, wordTarget ?? 1000
  );

  // tokens ≈ words × 2 to give the model room to write fully
  const maxTokens = Math.min(Math.ceil((wordTarget ?? 1000) * 2) + 300, 4000);

  const stream = await nvidia.chat.completions.create({
    model: MODELS.paperGenerator,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: maxTokens,
    temperature: 0.6,
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
