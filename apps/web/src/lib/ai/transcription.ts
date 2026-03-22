import { getApiKey } from "./ai-config";
import type { TranscriptionResult, TranscriptionSegment } from "@/types/transcription";

export async function transcribeAudioSarvam(file: File | Blob, duration: number): Promise<TranscriptionResult> {
	const apiKey = getApiKey("sarvam");
	if (!apiKey) {
		throw new Error("Sarvam API key is missing. Please configure it in AI Settings.");
	}

	const formData = new FormData();
	formData.append("file", file, "audio.mp4"); // Assuming audio/video file

	try {
		const res = await fetch("https://api.sarvam.ai/speech-to-text", {
			method: "POST",
			headers: {
				"api-subscription-key": apiKey,
			},
			body: formData,
		});

		if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Sarvam STT Failed: ${errText}`);
        }
		
        const data = await res.json();
		console.log("Sarvam DBG:", data);

        // Sarvam usually returns { transcript: string }
        const transcriptText = data.transcript || data.text || "";

        // Since many STT APIs don't return word-level timestamps by default,
        // we'll just create a single segment spanning the whole video duration
        // so that Hook Generator and Captions have something to display.
        const segment: TranscriptionSegment = {
            start: 0,
            end: duration,
            text: transcriptText,
        };

        return {
            text: transcriptText,
            language: "en", // Assuming default or detect
            segments: [segment],
        };
	} catch (error) {
		console.error("Failed to generate transcript with Sarvam:", error);
		throw error;
	}
}
