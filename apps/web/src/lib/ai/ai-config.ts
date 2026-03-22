export type AIProvider = "openai" | "gemini" | "groq";
export type TTSProvider = "elevenlabs" | "sarvam";

interface AIKeys {
	openai?: string;
	gemini?: string;
	groq?: string;
	elevenlabs?: string;
	sarvam?: string;
}

const STORAGE_KEY = "opencut_ai_keys";

export function getStoredKeys(): AIKeys {
	if (typeof window === "undefined") return {};
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return {};
	try {
		return JSON.parse(stored);
	} catch (e) {
		return {};
	}
}

export function saveKeys(keys: AIKeys): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getApiKey(provider: AIProvider | TTSProvider): string | undefined {
	const keys = getStoredKeys();
	return keys[provider];
}

export function hasAnyAIKey(): boolean {
	const keys = getStoredKeys();
	return !!(keys.openai || keys.gemini || keys.groq);
}

export function getPreferredAIProvider(): AIProvider | null {
	const keys = getStoredKeys();
	if (keys.openai) return "openai";
	if (keys.gemini) return "gemini";
	if (keys.groq) return "groq";
	return null;
}
