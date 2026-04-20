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

const FIELDS = "paperId,title,year,citationCount,abstract,authors,externalIds,openAccessPdf,fieldsOfStudy";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 20);
  const yearFrom = searchParams.get("yearFrom");
  const yearTo = searchParams.get("yearTo");

  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: FIELDS,
  });
  if (yearFrom || yearTo) {
    params.set("year", `${yearFrom ?? ""}-${yearTo ?? ""}`);
  }

  const headers: HeadersInit = { "User-Agent": "Ganbaro-App" };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
    { headers, next: { revalidate: 60 } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Semantic Scholar error:", res.status, text);
    if (res.status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again in a few seconds." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ papers: (data.data ?? []) as Paper[], total: data.total ?? 0 });
}
