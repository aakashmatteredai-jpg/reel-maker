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
	
	if (keys[provider]) return keys[provider];

	// Fallback to environment variables
	if (provider === "sarvam") return process.env.NEXT_PUBLIC_SARVAM_API_KEY;
	if (provider === "elevenlabs") return process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
	if (provider === "openai") return process.env.NEXT_PUBLIC_OPENAI_API_KEY;
	if (provider === "gemini") return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
	if (provider === "groq") return process.env.NEXT_PUBLIC_GROQ_API_KEY;

	return undefined;
}

export function hasAnyAIKey(): boolean {
	const keys = getStoredKeys();
	return !!(
		keys.openai || 
		keys.gemini || 
		keys.groq ||
		process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
		process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
		process.env.NEXT_PUBLIC_GROQ_API_KEY
	);
}

export function getPreferredAIProvider(): AIProvider | null {
	const keys = getStoredKeys();
	if (keys.openai || process.env.NEXT_PUBLIC_OPENAI_API_KEY) return "openai";
	if (keys.gemini || process.env.NEXT_PUBLIC_GEMINI_API_KEY) return "gemini";
	if (keys.groq || process.env.NEXT_PUBLIC_GROQ_API_KEY) return "groq";
	return null;
}
