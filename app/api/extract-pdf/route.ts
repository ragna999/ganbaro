import { NextRequest } from "next/server";

export const maxDuration = 60;

const MAX_CHARS = 500_000; // ~250 halaman

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const data = await pdfParse(buffer);

    return Response.json({
      text: (data.text as string).slice(0, MAX_CHARS),
      pages: data.numpages as number,
      fileName: file.name,
      truncated: (data.text as string).length > MAX_CHARS,
    });
  } catch (err) {
    console.error("PDF extraction error:", err);
    return Response.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
