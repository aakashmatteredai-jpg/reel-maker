import type { LanguageCode } from "./language";

export type TranscriptionLanguage = LanguageCode | "auto";

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
	speakerId?: string;
	gender?: "male" | "female" | "neutral" | string;
}

export interface TranscriptionResult {
	text: string;
	segments: TranscriptionSegment[];
	language: string;
}

export type TranscriptionStatus =
	| "idle"
	| "loading-model"
	| "transcribing"
	| "complete"
	| "error";

export interface TranscriptionProgress {
	status: TranscriptionStatus;
	progress: number;
	message?: string;
}

export type TranscriptionModelId =
	| "whisper-tiny"
	| "whisper-small"
	| "whisper-medium"
	| "whisper-large-v3-turbo";

export interface TranscriptionModel {
	id: TranscriptionModelId;
	name: string;
	huggingFaceId: string;
	description: string;
}

export interface CaptionChunk {
	text: string;
	startTime: number;
	duration: number;
}

export interface Character {
	id: string;
	name: string;
	gender?: "male" | "female" | "neutral" | string;
	ttsVoiceId?: string;
	ttsProvider?: "elevenlabs" | "sarvam";
    totalDuration: number;
    color: string;
}

export interface DubbingSegment extends TranscriptionSegment {
	dubbedAudioId?: string;
	isDubbed?: boolean;
}

export interface DubbingSpeaker {
	id: string;
	name: string;
	gender?: "male" | "female" | "neutral" | string;
	color: string;
	segments: DubbingSegment[];
	fullText: string;
	totalDuration: number;
	audioUrl?: string; // Blob URL — not persisted, regenerated on load
	ttsVoiceId?: string;
	ttsProvider?: "elevenlabs" | "sarvam";
	confirmed?: boolean;
}

export interface DubbingProjectSettings {
	captionsEnabled: boolean;
	selectedVoices: Record<string, { voiceId: string; provider: "elevenlabs" | "sarvam" }>;
}

export interface DubbingProject {
	id: string;
	name: string;
	createdAt: number;
	videoUrl?: string; // Blob URL — not persisted
	speakers: DubbingSpeaker[];
	originalSegments: DubbingSegment[];
	settings: DubbingProjectSettings;
}
