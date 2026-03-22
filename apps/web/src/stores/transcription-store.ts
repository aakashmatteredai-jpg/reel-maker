import { create } from "zustand";
import type { TranscriptionResult, TranscriptionStatus } from "@/types/transcription";

export interface TranscriptionStore {
	transcript: TranscriptionResult | null;
	status: TranscriptionStatus;
	progress: number;
	setTranscript: (transcript: TranscriptionResult | null) => void;
	setStatus: (status: TranscriptionStatus) => void;
	setProgress: (progress: number) => void;
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => ({
	transcript: null,
	status: "idle",
	progress: 0,
	setTranscript: (transcript) => set({ transcript }),
	setStatus: (status) => set({ status }),
	setProgress: (progress) => set({ progress }),
}));
