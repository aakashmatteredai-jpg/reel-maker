import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { text, voiceId, provider, languageCode } = await req.json();

        if (!text || !voiceId || !provider) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let audioBuffer: Buffer;

        if (provider === "elevenlabs") {
            const apiKey = process.env.ELEVENLABS_API_KEY;
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "xi-api-key": apiKey || "",
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { 
                        stability: 0.5, 
                        similarity_boost: 0.75 
                    }
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail?.status || "ElevenLabs TTS failed");
            }
            audioBuffer = Buffer.from(await res.arrayBuffer());
        } 
        else if (provider === "sarvam") {
            const apiKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY;
            const res = await fetch("https://api.sarvam.ai/text-to-speech", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-subscription-key": apiKey || "",
                },
                body: JSON.stringify({
                    inputs: [text],
                    target_language_code: languageCode || "hi-IN",
                    speaker: voiceId,
                    model: "bulbul:v3"
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || "Sarvam TTS failed");
            }
            const data = await res.json();
            if (!data.audios?.[0]) throw new Error("Sarvam returned no audio data");
            audioBuffer = Buffer.from(data.audios[0], "base64");
        } 
        else {
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        return new Response(new Uint8Array(audioBuffer), {
            headers: { 
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=3600"
            },
        });

    } catch (err: any) {
        console.error("TTS error:", err);
        return NextResponse.json({ error: err.message || "TTS generation failed" }, { status: 500 });
    }
}
