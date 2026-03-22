import { getApiKey } from "./ai-config";

export interface Voice {
	id: string;
	name: string;
	provider: "elevenlabs" | "sarvam";
	language: string;
	accent?: string;
	gender?: "male" | "female" | "neutral";
	previewUrl?: string; // Optional URL to play a sample
}

export async function fetchElevenLabsVoices(apiKey: string): Promise<Voice[]> {
	try {
		const res = await fetch("https://api.elevenlabs.io/v1/voices", {
			headers: {
				"xi-api-key": apiKey,
			},
		});
		if (!res.ok) throw new Error(await res.text());
		const data = await res.json();

		return data.voices.map((v: any) => ({
			id: v.voice_id,
			name: v.name,
			provider: "elevenlabs",
			language: v.labels?.language || "en",
			accent: v.labels?.accent || "american",
			gender: v.labels?.gender || "neutral",
			previewUrl: v.preview_url,
		}));
	} catch (error) {
		console.error("ElevenLabs fetch errors:", error);
		return [];
	}
}

export async function fetchSarvamVoices(apiKey: string): Promise<Voice[]> {
	// Sarvam API offers multiple voices for Indian languages like Hindi, Tamil, Telugu, etc.
	// Hardcoding standard voices as Sarvam might not have a /voices endpoint in standard docs
	// Based on Sarvam TTS documentation
	return [
		{ id: "Auroville", name: "Auroville", provider: "sarvam", language: "en-IN", gender: "male" },
		{ id: "Malgudi", name: "Malgudi", provider: "sarvam", language: "en-IN", gender: "female" },
		{ id: "hi-IN-Standard-A", name: "Hindi Standard A", provider: "sarvam", language: "hi-IN", gender: "female" },
		{ id: "hi-IN-Standard-B", name: "Hindi Standard B", provider: "sarvam", language: "hi-IN", gender: "male" },
		{ id: "ta-IN-Standard-A", name: "Tamil Standard A", provider: "sarvam", language: "ta-IN", gender: "female" },
		{ id: "te-IN-Standard-A", name: "Telugu Standard A", provider: "sarvam", language: "te-IN", gender: "female" },
	];
}

export async function getAvailableVoices(): Promise<Voice[]> {
	const elevenLabsKey = getApiKey("elevenlabs");
	const sarvamKey = getApiKey("sarvam");

	const voices: Voice[] = [];

	if (elevenLabsKey) {
		const elVoices = await fetchElevenLabsVoices(elevenLabsKey);
		voices.push(...elVoices);
	}

	if (sarvamKey) {
		const srVoices = await fetchSarvamVoices(sarvamKey);
		voices.push(...srVoices);
	}

	return voices;
}

export async function generateSpeech(
	provider: "elevenlabs" | "sarvam",
	text: string,
	voiceId: string
): Promise<Blob> {
	const apiKey = getApiKey(provider);
	if (!apiKey) {
		throw new Error(`${provider} API key not found. Please configure it in Settings.`);
	}

	if (provider === "elevenlabs") {
		const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": apiKey,
			},
			body: JSON.stringify({
				text,
				model_id: "eleven_monolingual_v1",
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.5,
				},
			}),
		});

		if (!res.ok) throw new Error(await res.text());
		return await res.blob();
	} else if (provider === "sarvam") {
		// Example Sarvam TTS request
		const res = await fetch("https://api.sarvam.ai/text-to-speech", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-subscription-key": apiKey,
			},
			body: JSON.stringify({
				inputs: [text],
				target_language_code: voiceId.split("-").slice(0, 2).join("-") || "hi-IN", // Parse language from voiceId
				speaker: voiceId,
				pitch: 0,
				pace: 1.0,
				loudness: 1.5,
				speech_sample_rate: 16000,
				enable_preprocessing: true,
				model: "bulbul:v1",
			}),
		});

		if (!res.ok) throw new Error(await res.text());
		const data = await res.json();
		// Sarvam typically returns base64 audio in the response
		const audioBase64 = data.audios[0];
		
		const byteCharacters = atob(audioBase64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray], { type: "audio/wav" });
	}

	throw new Error("Invalid provider");
}
