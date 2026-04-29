import { NextRequest, NextResponse } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

// ── Ref helpers ──────────────────────────────────────────────────────────────

interface RefPaper {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
}

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
    return (data.results ?? []).map((w: any): RefPaper => ({
      title: w.title ?? "Untitled",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authors: (w.authorships ?? []).slice(0, 3).map((a: any) => a.author?.display_name ?? "").filter(Boolean),
      year: w.publication_year ?? null,
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
    }));
  } catch {
    return [];
  }
}

// ── Law (Wikisource) helpers ──────────────────────────────────────────────────

function cleanWikitext(text: string): string {
  return text
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:File|Berkas|Gambar|Category|Kategori):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/={2,}([^=]+)={2,}/g, "\n$1\n")
    .replace(/'{2,3}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseWikisourceTitle(lawInput: string): string | null {
  const text = lawInput.trim();
  const numYear =
    text.match(/(\d+)\s*(?:\/|Tahun)\s*(\d{4})/i) ??
    text.match(/No\.?\s*(\d+)[^0-9]*(\d{4})/i);
  if (!numYear) return null;
  const [, num, year] = numYear;
  const upper = text.toUpperCase();
  if (/^PP\b|PERATURAN\s+PEMERINTAH/.test(upper))
    return `Peraturan_Pemerintah_Nomor_${num}_Tahun_${year}`;
  if (/PERPRES|PERATURAN\s+PRESIDEN/.test(upper))
    return `Peraturan_Presiden_Nomor_${num}_Tahun_${year}`;
  return `Undang-Undang_Republik_Indonesia_Nomor_${num}_Tahun_${year}`;
}

async function fetchLawText(lawInput: string): Promise<{ name: string; text: string } | null> {
  const title = parseWikisourceTitle(lawInput);
  if (!title) return null;
  try {
    const url = `https://id.wikisource.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GanbaroApp/1.0 (yaumglyy@gmail.com)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;
    const wikitext: string = page.revisions?.[0]?.slots?.main?.content ?? "";
    if (!wikitext) return null;
    const cleaned = cleanWikitext(wikitext);
    return { name: lawInput.trim(), text: cleaned.slice(0, 6000) };
  } catch {
    return null;
  }
}

// ── Localization ──────────────────────────────────────────────────────────────

const LOCALIZED_SECTIONS: Record<string, Record<string, string>> = {
  Indonesian: {
    Abstract: "Abstrak",
    Introduction: "Pendahuluan",
    Methodology: "Metodologi Penelitian",
    "Results and Discussion": "Hasil dan Pembahasan",
    Conclusion: "Penutup",
    References: "Daftar Pustaka",
  },
  Spanish: {
    Abstract: "Resumen",
    Introduction: "Introducción",
    Methodology: "Metodología",
    "Results and Discussion": "Resultados y Discusión",
    Conclusion: "Conclusión",
    References: "Referencias",
  },
  French: {
    Abstract: "Résumé",
    Introduction: "Introduction",
    Methodology: "Méthodologie",
    "Results and Discussion": "Résultats et Discussion",
    Conclusion: "Conclusion",
    References: "Références",
  },
  German: {
    Abstract: "Zusammenfassung",
    Introduction: "Einleitung",
    Methodology: "Methodik",
    "Results and Discussion": "Ergebnisse und Diskussion",
    Conclusion: "Fazit",
    References: "Literaturverzeichnis",
  },
  Portuguese: {
    Abstract: "Resumo",
    Introduction: "Introdução",
    Methodology: "Metodologia",
    "Results and Discussion": "Resultados e Discussão",
    Conclusion: "Conclusão",
    References: "Referências",
  },
};

function localizeSection(sectionName: string, language: string): string {
  return LOCALIZED_SECTIONS[language]?.[sectionName] ?? sectionName;
}

// ── Citation rules ────────────────────────────────────────────────────────────

const CITATION_RULES: Record<string, string> = {
  Abstract:
    "Do NOT use any in-text citations. Write entirely from the paper's own findings.",
  Introduction:
    "Use APA citations (Author, Year) to support background claims and justify the research gap. For laws, cite as 'Pasal N UU No. X Tahun Y' or '(UU No. X Tahun Y)'. Cite only where claims need external support.",
  Methodology:
    "Cite (Author, Year) only when justifying research design choices. For laws, cite relevant pasal by number. Do not cite for your own procedural steps.",
  "Results and Discussion":
    "Use (Author, Year) only when comparing findings with prior literature. Cite specific pasal when discussing legal provisions. Your own findings and analysis need no citation.",
  Conclusion:
    "Do NOT use in-text citations. Summarize only from the paper's own findings and arguments.",
};

// ── Section guides ────────────────────────────────────────────────────────────

const SECTION_GUIDES: Record<string, (chunk: number, total: number) => string> = {
  Abstract: () =>
    "Write a structured abstract covering: research background and problem, objectives, methodology, key findings, and conclusions. Be precise. No citations.",
  Introduction: () =>
    "Write a comprehensive introduction covering: (1) research background and context, (2) theoretical/conceptual framework relevant to the topic — discuss key theories, concepts, and legal basis (cite laws by pasal where relevant), (3) identification of the research gap supported by literature, (4) research objectives and questions, (5) significance of the study, (6) brief overview of the paper structure.",
  Methodology: () =>
    "Write a detailed methodology section covering: (1) research design and paradigm with justification, (2) data sources and collection methods, (3) analytical framework or instruments, (4) validity/reliability measures, (5) methodological limitations.",
  "Results and Discussion": (chunk, total) =>
    chunk === 0
      ? "Present and discuss the main findings in depth. For each finding: present the evidence, interpret its meaning, connect to research objectives. Where relevant, cite specific pasal from the provided laws and compare with scholarly literature."
      : `Continue results and discussion (part ${chunk + 1} of ${total}). Present additional findings. Compare and contrast with existing literature and legal provisions where relevant. Discuss theoretical and practical implications.`,
  Conclusion: () =>
    "Write a comprehensive conclusion covering: (1) restatement of research objectives, (2) summary of key findings, (3) theoretical and practical contributions, (4) study limitations, (5) recommendations and future research directions. No citations.",
};

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  title: string,
  language: string,
  citationContext: string,
  lawContext: string,
  sectionName: string,
  chunkIndex: number,
  totalChunks: number,
  wordTarget: number
): string {
  const localName = localizeSection(sectionName, language);
  const partNote = totalChunks > 1 ? ` (Part ${chunkIndex + 1} of ${totalChunks})` : "";
  const guide = SECTION_GUIDES[sectionName]?.(chunkIndex, totalChunks) ?? "Write this section thoroughly and academically.";
  const citationRule = CITATION_RULES[sectionName] ?? "Use APA (Author, Year) and legal citations where appropriate.";
  const continuation = chunkIndex > 0 ? "\nThis is a continuation — do not repeat previous content. Continue naturally." : "";

  const lawBlock = lawContext
    ? `\nPROVIDED LAWS — use these for accurate legal citations (cite as "Pasal N UU No. X Tahun Y"):\n${lawContext}`
    : "";

  return `You are an expert academic writer writing a section of a formal academic paper.

PAPER TITLE: "${title}"
LANGUAGE: Write entirely in ${language}. Use formal academic ${language}.
SECTION: ${localName}${partNote}

${citationContext}${lawBlock}

TASK: Write ONLY the body text of the ${localName} section${partNote}. Do NOT include the section heading.${continuation}

CONTENT GUIDE:
${guide}

WORD COUNT: This section MUST be at least ${wordTarget} words. Write in full, dense academic paragraphs. Be thorough — do not stop early.

CITATION RULE: ${citationRule}

FORMATTING: Continuous prose paragraphs only. No bullet points. No subheadings unless academically required.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Mode: refs ──
  if (body.mode === "refs") {
    const { title, numRefs } = body;
    if (!title?.trim()) return NextResponse.json({ bibliography: [], citationContext: "" });
    const rawRefs = await fetchReferences(title.trim(), Math.min(numRefs ?? 10, 25));
    const bibliography = rawRefs.map((r, i) => formatApaEntry(r, i));
    const citationContext =
      bibliography.length > 0
        ? `AVAILABLE REFERENCES (cite in-text as (Author, Year)):\n${bibliography.join("\n")}`
        : "Generate plausible APA-style citations inline where appropriate.";
    return NextResponse.json({ bibliography, citationContext });
  }

  // ── Mode: laws ──
  if (body.mode === "laws") {
    const { laws } = body as { laws: string[] };
    if (!Array.isArray(laws) || laws.length === 0)
      return NextResponse.json({ lawContexts: [], lawContext: "" });

    const results = await Promise.all(laws.map(fetchLawText));
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    const notFound = laws.filter((_, i) => results[i] === null);

    const lawContexts = found.map((r) => ({ name: r.name, found: true, preview: r.text.slice(0, 100) }));
    const lawContext = found.length > 0
      ? found.map((r) => `=== ${r.name} ===\n${r.text}`).join("\n\n")
      : "";

    return NextResponse.json({ lawContexts, lawContext, notFound });
  }

  // ── Mode: section ──
  const { title, language, citationContext, lawContext, sectionName, chunkIndex, totalChunks, wordTarget } = body;
  if (!title?.trim() || !sectionName) return new Response("Missing required fields", { status: 400 });

  const prompt = buildPrompt(
    title,
    language ?? "English",
    citationContext ?? "Generate plausible APA-style citations inline.",
    lawContext ?? "",
    sectionName,
    chunkIndex ?? 0,
    totalChunks ?? 1,
    wordTarget ?? 1000
  );

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

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
