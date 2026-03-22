import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ error: "No file" }, { status: 400 });
        }

        const groqFormData = new FormData();
        groqFormData.append("file", file);
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("response_format", "verbose_json");

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API}`,
            },
            body: groqFormData,
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq STT failed: ${err}`);
        }

        const data = await response.json();
        // verbose_json returns segments with start/end
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("STT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
