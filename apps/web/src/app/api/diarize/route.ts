import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const pyannoteForm = new FormData();
    pyannoteForm.append("file", audioFile, "audio.wav");

    const response = await fetch("http://localhost:8000/diarize", {
      method: "POST",
      body: pyannoteForm,
    });

    if (!response.ok) {
      throw new Error(`Pyannote server error: ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Diarization error:", error);
    return NextResponse.json(
      { error: "Diarization failed", details: String(error) },
      { status: 500 }
    );
  }
}
