import { getApiKey, getPreferredAIProvider } from "./ai-config";

export interface HookGenerationResult {
	hooks: string[];
	caption: string;
	hashtags: string[];
}

const SYSTEM_PROMPT = `You are an expert social media manager and copywriter specializing in short-form content (TikTok, Reels, Shorts).
Given a transcript of a video, generate:
1. 3 highly engaging, scroll-stopping hooks that can be added as text on screen. Keep them under 10 words.
2. A compelling short caption describing the video.
3. 5 relevant hashtags.
Respond ONLY with a JSON object in this format:
{
  "hooks": ["Hook 1", "Hook 2", "Hook 3"],
  "caption": "Your compelling caption here...",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

export async function generateHooks(transcript: string): Promise<HookGenerationResult> {
	const provider = getPreferredAIProvider();
	if (!provider) {
		throw new Error("No AI provider configured. Please set an API key in the AI Settings.");
	}

	const apiKey = getApiKey(provider);
	if (!apiKey) {
		throw new Error(`API key for ${provider} is missing.`);
	}

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
						{ role: "user", content: `Transcript:\n\n${transcript}` },
					],
					response_format: { type: "json_object" },
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
						contents: [{ parts: [{ text: `Transcript:\n\n${transcript}` }] }],
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
						{ role: "user", content: `Transcript:\n\n${transcript}` },
					],
					response_format: { type: "json_object" },
				}),
			});

			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			responseContent = data.choices[0].message.content;
		}

		return JSON.parse(responseContent) as HookGenerationResult;
	} catch (error) {
		console.error("Failed to generate hooks:", error);
		throw new Error("Failed to communicate with AI provider.");
	}
}
