import { NextRequest, NextResponse } from "next/server";

export interface Paper {
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  abstract: string | null;
  authors: { name: string }[];
  externalIds: { DOI?: string; ArXiv?: string } | null;
  openAccessPdf: { url: string } | null;
  fieldsOfStudy: string[] | null;
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string | null {
  if (!invertedIndex) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(" ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWork(w: any): Paper {
  const doi = w.doi ? w.doi.replace("https://doi.org/", "") : undefined;

  const arxivLocation = (w.locations ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (l: any) => l.source?.host_organization_name?.toLowerCase().includes("arxiv")
  );
  const arxivId = arxivLocation?.landing_page_url?.match(/arxiv\.org\/abs\/(.+)/)?.[1];

  const oaPdfUrl =
    w.open_access?.oa_url ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w.locations ?? []).find((l: any) => l.pdf_url)?.pdf_url ??
    null;

  return {
    paperId: w.id ?? "",
    title: w.title ?? "Untitled",
    year: w.publication_year ?? null,
    citationCount: w.cited_by_count ?? 0,
    abstract: reconstructAbstract(w.abstract_inverted_index),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authors: (w.authorships ?? []).slice(0, 10).map((a: any) => ({ name: a.author?.display_name ?? "" })),
    externalIds: doi || arxivId ? { DOI: doi, ArXiv: arxivId } : null,
    openAccessPdf: oaPdfUrl ? { url: oaPdfUrl } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fieldsOfStudy: (w.topics ?? w.concepts ?? []).slice(0, 4).map((t: any) => t.display_name),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 20);
  const yearFrom = searchParams.get("yearFrom");
  const yearTo = searchParams.get("yearTo");

  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const params = new URLSearchParams({
    search: query,
    "per-page": String(limit),
    select: "id,title,publication_year,cited_by_count,abstract_inverted_index,authorships,doi,open_access,locations,topics,concepts",
    mailto: "yaumglyy@gmail.com",
  });

  if (yearFrom || yearTo) {
    params.set("filter", `publication_year:${yearFrom ?? ""}${yearTo ? `-${yearTo}` : ""}`);
  }

  const res = await fetch(
    `https://api.openalex.org/works?${params}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    console.error("OpenAlex error:", res.status, await res.text());
    if (res.status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again in a few seconds." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 502 });
  }

  const data = await res.json();
  const papers: Paper[] = (data.results ?? []).map(mapWork);
  return NextResponse.json({ papers, total: data.meta?.count ?? 0 });
}
