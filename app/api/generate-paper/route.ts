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
    return { name: lawInput.trim(), text: cleaned.slice(0, 40000) };
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
    "Do NOT use any in-text citations. After the Indonesian abstract body, write 'Kata Kunci:' with 4–6 relevant keywords. Then write 'Abstract:' with the full English translation of the abstract, followed by 'Keywords:' with the English keywords.",
  Introduction:
    "Use APA 6 bodynote in-text citations (Author, Year) to support every major claim — background, theoretical context, and research gap. For laws, cite as '(Pasal N UU No. X Tahun Y)'. Prioritize literature published within the last 5 years.",
  Methodology:
    "Use APA 6 bodynote (Author, Year) only when justifying the choice of research type, approach, or analytical method. For laws, cite the relevant pasal. Prioritize references from the last 5 years. Keep citations minimal but precise.",
  "Results and Discussion":
    "Use APA 6 bodynote (Author, Year) when linking findings to legal theories, court decisions, regulations (cite pasal specifically), and scholarly literature. Your own analytical interpretations of findings do not need citations. Prioritize references from the last 5 years.",
  Conclusion:
    "Do NOT use any in-text citations. Write only from the paper's own conclusions and recommendations.",
};

// ── Section guides ────────────────────────────────────────────────────────────

const SECTION_GUIDES: Record<string, (chunk: number, total: number) => string> = {
  Abstract: () =>
    `Write a concise, clear, and informative abstract for a legal journal article consisting of exactly four elements in this order: (1) context and legal problem background, (2) research objectives, (3) research method — state the type (normative/empirical/combination) and approach(es) used, (4) main findings and research contributions. Length: 150–250 words. Style: dense, objective, academic — no circumlocutions, no citations, no sub-headings. After the abstract body, write "Kata Kunci:" followed by 4–6 relevant keywords in Indonesian. Then on a new line write "Abstract:" and provide the full English translation of the abstract, followed by "Keywords:" with the English keywords.`,

  Introduction: () =>
    `Write a systematic and academic introduction for a legal journal article. Cover all of these elements in a single continuous flowing prose — absolutely NO sub-sections, NO sub-headings, NO bullet points, NO numbered lists: (1) research problem background — the legal phenomenon or issue, (2) theoretical context — connect with relevant legal theories, applicable regulations, and court decisions, (3) research urgency and its current relevance, (4) research gap clearly identified and supported by literature, (5) research objectives and research questions, (6) academic and practical relevance of the study. The text must flow logically, contain strong argumentation, and clarify the research position in contemporary legal discourse. Use formal academic Indonesian legal writing style. Every major claim must be backed by an APA 6 bodynote citation.`,

  Methodology: () =>
    `Write the research methodology section in exactly 2 paragraphs — narrative prose only, absolutely NO bullet points, NO numbering, NO sub-headings. Distribute all of the following naturally across the 2 paragraphs: (1) type of research — normative, empirical, or combination — with clear justification, (2) research approach — choose ONLY the approach(es) that genuinely fit the paper title from this list: statute approach, case approach, conceptual approach, comparative approach, empirical approach — do NOT use all of them; select only 1–3 that are appropriate and explain why, (3) sources and techniques for collecting primary and secondary legal materials, (4) data or legal material analysis technique, (5) methodological rationale consistent with the research objectives and scope. Write academically, formally, and argumentatively.`,

  "Results and Discussion": (chunk, total) =>
    chunk === 0
      ? `Write a structured, analytical, and argumentative results and discussion section for a legal journal article. Present the main research findings consistent with the type and approach of research used. For each finding: present the evidence or normative basis, interpret its legal meaning, connect to research objectives. Link findings with legal theories, applicable regulations — cite specific pasal — court decisions, and relevant scholarly literature. Provide critical legal analysis including: normative interpretation, legal comparison, identification of normative weaknesses or legal gaps (kekosongan norma), and conceptual and practical implications. The discussion must flow logically, be consistent with the research objectives, and strengthen the scientific legal argument.`
      : `Continue the results and discussion (part ${chunk + 1} of ${total}). Continue analytical and argumentative discussion of further legal findings or issues. Maintain consistency with theories, regulations (cite pasal specifically), court decisions, and literature. Deepen critical legal analysis, normative interpretation, and discuss broader legal implications including de lege ferenda perspectives. Do not repeat content from previous parts.`,

  Conclusion: () =>
    `Write the closing section (Penutup) in exactly 1 paragraph that integrates both conclusion and recommendations. First part: formulate the conclusion based on the main research findings and arguments — do not repeat the discussion, but firmly assert the core results of the legal analysis in a systematic manner. Second part (in the same paragraph): provide operational and relevant recommendations covering legal theory development, regulatory improvement (de lege ferenda), law enforcement practice, and/or directions for further research. Use formal, objective language. No citations. Consistent with the research objectives and the overall flow of the paper.`,
};

// ── Prompt builder ────────────────────────────────────────────────────────────

const KUHAP_NOTE =
  "IMPORTANT: When referencing criminal procedure law, always use the latest KUHAP (UU No. 20 Tahun 2025), not the old UU No. 8 Tahun 1981.";

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
  const citationRule = CITATION_RULES[sectionName] ?? "Use APA 6 bodynote (Author, Year) and legal citations where appropriate. Prioritize references from the last 5 years.";
  const continuation = chunkIndex > 0 ? "\nThis is a continuation — do not repeat previous content. Continue naturally from where the previous part ended." : "";

  const lawBlock = lawContext
    ? `\nPROVIDED LAWS — use these for accurate legal citations (cite as "(Pasal N UU No. X Tahun Y)"):\n${lawContext}`
    : "";

  return `You are an expert academic legal writer writing a section of a formal Indonesian legal journal article (artikel jurnal hukum).

PAPER TITLE: "${title}"
LANGUAGE: Write entirely in ${language}. Use formal academic ${language} appropriate for legal scholarship.
SECTION: ${localName}${partNote}

${KUHAP_NOTE}

${citationContext}${lawBlock}

TASK: Write ONLY the body text of the ${localName} section${partNote}. Do NOT include the section heading.${continuation}

CONTENT GUIDE:
${guide}

WORD COUNT: This section MUST be at least ${wordTarget} words. Write in full, dense academic paragraphs. Be thorough — do not stop early.

CITATION RULE: ${citationRule}

FORMATTING: Continuous prose paragraphs only. No bullet points. No numbered lists. No sub-headings unless the guide explicitly requires them.`;
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
