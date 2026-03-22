import { EditorCore } from "..";

export type DubStage =
	| "idle"
	| "extracting"
	| "transcribing"
	| "diarizing"
	| "slicing"
	| "merging"
	| "done"
	| "error";

export interface SpeakerSegment {
	speaker: string;
	start: number;
	end: number;
	text?: string;
	mergedStart?: number;
}

export interface SpeakerData {
	id: string;
	segments: SpeakerSegment[];
	mergedAudioKey: string;
	totalDuration: number;
}

export interface DubState {
	stage: DubStage;
	progress: number;
	error: string | null;
	speakers: SpeakerData[];
	transcript: SpeakerSegment[];
	rawAudioKey: string | null;
}

const INITIAL_STATE: DubState = {
	stage: "idle",
	progress: 0,
	error: null,
	speakers: [],
	transcript: [],
	rawAudioKey: null,
};

export class DubManager {
	private state: DubState = { ...INITIAL_STATE };
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	getState(): DubState {
		return { ...this.state };
	}

	updateState(update: Partial<DubState>) {
		this.state = { ...this.state, ...update };
		this.notify();
	}

	reset() {
		this.state = { ...INITIAL_STATE };
		this.notify();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
