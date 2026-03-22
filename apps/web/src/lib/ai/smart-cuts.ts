import { getApiKey, getPreferredAIProvider } from "./ai-config";
import type { TranscriptionResult } from "@/types/transcription";

export interface CutSegment {
	start: number;
	end: number;
}

const SYSTEM_PROMPT = `You are a professional video editor. You will be given a transcript of a video, including start and end timestamps for each word or segment (in seconds).
Your job is to identify filler words (um, uh, like), long awkward silences, or mistakes where the speaker repeats themselves, and return the exact timestamps of the segments to CUT OUT.
Respond ONLY with a JSON array of objects, where each object has "start" and "end" properties (numbers in seconds).
Example:
[
  { "start": 2.5, "end": 3.1 },
  { "start": 10.0, "end": 12.5 }
]
If there's nothing to cut, return an empty array [].`;

export async function generateSmartCuts(transcript: TranscriptionResult): Promise<CutSegment[]> {
	const provider = getPreferredAIProvider();
	if (!provider) {
		throw new Error("No AI provider configured. Please set an API key in the AI Settings.");
	}

	const apiKey = getApiKey(provider);
	if (!apiKey) {
		throw new Error(`API key for ${provider} is missing.`);
	}

	// Format transcript with timestamps
	const formattedTranscript = transcript.segments
		.map(seg => `[${seg.start.toFixed(2)}s -> ${seg.end.toFixed(2)}s] ${seg.text}`)
		.join("\n");

	let responseContent = "";

	try {
		if (provider === "openai") {
			const res = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [
						{ role: "system", content: SYSTEM_PROMPT },
						{ role: "user", content: `Transcript:\n\n${formattedTranscript}` },
					],
				}),
			});

			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			responseContent = data.choices[0].message.content;
		} else if (provider === "gemini") {
			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
						contents: [{ parts: [{ text: `Transcript:\n\n${formattedTranscript}` }] }],
						generationConfig: { responseMimeType: "application/json" },
					}),
				}
			);

			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			responseContent = data.candidates[0].content.parts[0].text;
		} else if (provider === "groq") {
			const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "llama-3.3-70b-versatile",
					messages: [
						{ role: "system", content: SYSTEM_PROMPT },
						{ role: "user", content: `Transcript:\n\n${formattedTranscript}` },
					],
				}),
			});

			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			responseContent = data.choices[0].message.content;
		}

		// Clean up response if the AI generated markdown blocks
		const cleanedJson = responseContent.replace(/```json|```/g, "").trim();
		const result = JSON.parse(cleanedJson) as CutSegment[];
		
		if (!Array.isArray(result)) {
			throw new Error("Invalid response format from AI");
		}
		
		return result;
	} catch (error) {
		console.error("Failed to generate smart cuts:", error);
		throw new Error("Failed to communicate with AI provider or parse response.");
	}
}
