import type { EditorCore } from "@/core";
import type { TranscriptionResult, TranscriptionStatus } from "@/types/transcription";

export class TranscriptionManager {
	private transcript: TranscriptionResult | null = null;
	private status: TranscriptionStatus = "idle";
	private progress: number = 0;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	setTranscript(transcript: TranscriptionResult | null): void {
		this.transcript = transcript;
		this.notify();
	}

	getTranscript(): TranscriptionResult | null {
		return this.transcript;
	}

	setStatus(status: TranscriptionStatus): void {
		this.status = status;
		this.notify();
	}

	getStatus(): TranscriptionStatus {
		return this.status;
	}

	setProgress(progress: number): void {
		this.progress = progress;
		this.notify();
	}

	getProgress(): number {
		return this.progress;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
