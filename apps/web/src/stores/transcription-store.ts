import { create } from "zustand";
import type { TranscriptionResult, TranscriptionStatus } from "@/types/transcription";
import { EditorCore } from "@/core";

export interface TranscriptionStore {
	transcript: TranscriptionResult | null;
	status: TranscriptionStatus;
	progress: number;
	setTranscript: (transcript: TranscriptionResult | null) => void;
	setStatus: (status: TranscriptionStatus) => void;
	setProgress: (progress: number) => void;
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => {
	const editor = EditorCore.getInstance();
	
	// Subscribe to core changes
	editor.transcription.subscribe(() => {
		set({
			transcript: editor.transcription.getTranscript(),
			status: editor.transcription.getStatus(),
			progress: editor.transcription.getProgress(),
		});
	});

	return {
		transcript: editor.transcription.getTranscript(),
		status: editor.transcription.getStatus(),
		progress: editor.transcription.getProgress(),
		setTranscript: (transcript) => editor.transcription.setTranscript(transcript),
		setStatus: (status) => editor.transcription.setStatus(status),
		setProgress: (progress) => editor.transcription.setProgress(progress),
	};
});
