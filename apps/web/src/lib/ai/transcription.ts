import type { TranscriptionResult, TranscriptionSegment } from "@/types/transcription";
import { chunkAudioFile } from "./audio-utils";

export async function transcribeAudioSarvam(file: File | Blob, duration: number): Promise<TranscriptionResult> {
	try {
        // Sarvam Sync API max limit is 30s, so we chunk it into 29s segments.
        const chunkDuration = 29;
        console.log(`Chunking audio of duration ${duration}s...`);
        const chunks = await chunkAudioFile(file, chunkDuration);
        console.log(`Split into ${chunks.length} chunks.`);

        const allSegments: TranscriptionSegment[] = [];
        let totalText = "";

        // Process sequentially so we don't hit rate limits or overload the server API
        for (let i = 0; i < chunks.length; i++) {
            const chunkBlob = chunks[i];
            const formData = new FormData();
            formData.append("file", chunkBlob, `chunk_${i}.wav`);

            console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
            const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server API Failed: ${res.statusText}`);
            }
            
            const data = await res.json();
            const chunkText = data.transcript || data.text || "";

            if (chunkText.trim()) {
                totalText += (totalText ? " " : "") + chunkText;
                
                const startOffset = i * chunkDuration;
                // Last chunk might be shorter
                const endOffset = Math.min((i + 1) * chunkDuration, duration);

                allSegments.push({
                    start: startOffset,
                    end: endOffset,
                    text: chunkText,
                });
            }
        }

        return {
            text: totalText,
            language: "en", 
            segments: allSegments,
        };
	} catch (error) {
		console.error("Failed to generate transcript via backend:", error);
		throw error;
	}
}

export async function diarizeAudio(file: File | Blob): Promise<TranscriptionResult> {
    try {
        const formData = new FormData();
        formData.append("file", file, "audio.wav");

        const res = await fetch("/api/diarize", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Diarization API Failed: ${res.statusText}`);
        }
        
        return await res.json();
    } catch (error) {
        console.error("Failed to diarize audio:", error);
        throw error;
    }
}
