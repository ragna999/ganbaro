import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured. Add it to .env.local to enable transcription." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const audio = formData.get("audio") as File | null;
  if (!audio) return NextResponse.json({ error: "No audio file provided." }, { status: 400 });

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    return NextResponse.json({
      text: transcription.text,
      segments: (transcription as unknown as { segments?: { start: number; end: number; text: string }[] }).segments ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Transcription failed.";
    console.error("Groq transcription error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
