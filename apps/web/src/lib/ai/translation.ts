import { getApiKey, getPreferredAIProvider } from "./ai-config";

/**
 * Translates text into the target language using the configured AI provider.
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
	const provider = getPreferredAIProvider();
	const apiKey = provider ? getApiKey(provider) : null;

	if (!provider || !apiKey) {
		throw new Error("AI provider or API key not found. Please configure it in Settings.");
	}

	// For now, only OpenAI/Gemini support standard JSON translation easily
    // We'll call a server-side route for translation to avoid exposing complexity
	const res = await fetch("/api/translate", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			text,
			targetLanguage,
			provider,
			apiKey,
		}),
	});

	if (!res.ok) throw new Error(await res.text());
	const data = await res.json();
	return data.translatedText;
}
