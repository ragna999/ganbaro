import { NextRequest, NextResponse } from "next/server";
import { nvidia, MODELS } from "@/lib/nvidia";

export const maxDuration = 60;

export interface ClipSuggestion {
  start: number;
  end: number;
  reason: string;
  quote: string;
}

export async function POST(req: NextRequest) {
  const { segments } = await req.json();

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "No transcript segments provided." }, { status: 400 });
  }

  const segmentText = segments
    .map((s: { start: number; end: number; text: string }) =>
      `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.text.trim()}`
    )
    .join("\n");

  const prompt = `You are a video editor assistant. Given the transcript segments below (with timestamps), identify 3 to 5 of the most interesting, impactful, or self-contained moments that would make great short clips (each between 10 and 90 seconds long).

Transcript:
${segmentText}

Return ONLY a valid JSON array with no markdown, no explanation, just the array. Each object must have:
- "start": number (start time in seconds)
- "end": number (end time in seconds)
- "reason": string (1 sentence why this is a good clip)
- "quote": string (a short representative quote from the segment, max 80 chars)

Example:
[{"start":12.5,"end":34.0,"reason":"Clear explanation of the core concept.","quote":"...the key insight here is..."}]`;

  const response = await nvidia.chat.completions.create({
    model: MODELS.repoExplainer,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let suggestions: ClipSuggestion[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) suggestions = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ suggestions });
}
