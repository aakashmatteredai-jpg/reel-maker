import { getApiKey } from "./ai-config";
import type { TranscriptionResult, TranscriptionSegment } from "@/types/transcription";

export async function transcribeAudioSarvam(file: File | Blob, duration: number): Promise<TranscriptionResult> {
	const formData = new FormData();
	formData.append("file", file, "audio.mp4");

	try {
        // We now hit our Next.js backend API built to hide the API credentials
		const res = await fetch("/api/transcribe", {
			method: "POST",
			body: formData,
		});

		if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server API Failed: ${res.statusText}`);
        }
		
        const data = await res.json();
		console.log("Transcription Response:", data);

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
		console.error("Failed to generate transcript via backend:", error);
		throw error;
	}
}
