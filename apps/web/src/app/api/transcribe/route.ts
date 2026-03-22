import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const apiKey = formData.get("apiKey") as string | null;
        
        if (!apiKey) {
            return NextResponse.json({ error: "Sarvam API Key is required. Please add it in settings." }, { status: 400 });
        }

        // Forward the FormData to Sarvam's API
        const sarvamFormData = new FormData();
        sarvamFormData.append("file", file, "audio.mp4");

        const res = await fetch("https://api.sarvam.ai/speech-to-text", {
            method: "POST",
            headers: {
                "api-subscription-key": apiKey,
            },
            body: sarvamFormData,
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Sarvam API Error:", errText);
            return NextResponse.json({ error: `Sarvam STT Failed: ${errText}` }, { status: res.status });
        }

        const data = await res.json();
        
        return NextResponse.json(data);
	} catch (error) {
		console.error("Transcription API error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 }
		);
	}
}
