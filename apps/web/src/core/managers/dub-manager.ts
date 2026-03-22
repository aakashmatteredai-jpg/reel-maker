import { EditorCore } from "..";

export type DubStage =
	| "idle"
	| "extracting"
	| "transcribing"
	| "translating"
	| "diarizing"
	| "slicing"
	| "merging"
	| "dubbing"
	| "done"
	| "error";

export interface SpeakerSegment {
	speaker: string;
	start: number;
	end: number;
	text?: string;
	mergedStart?: number;
	dubbedAudioKey?: string;
}

export interface SpeakerData {
	id: string;
	segments: SpeakerSegment[];
	mergedAudioKey: string;
	mergedDubbedAudioKey?: string;
	totalDuration: number;
	voiceProvider?: "elevenlabs" | "sarvam";
	voiceId?: string;
}

export interface DubState {
	stage: DubStage;
	progress: number;
	error: string | null;
	speakers: SpeakerData[];
	transcript: SpeakerSegment[];
	targetTranscript?: SpeakerSegment[];
	targetLanguage?: string;
	isDubbingEnabled: boolean;
	rawAudioKey: string | null;
}

const INITIAL_STATE: DubState = {
	stage: "idle",
	progress: 0,
	error: null,
	speakers: [],
	transcript: [],
	isDubbingEnabled: false,
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

	updateSpeakerSegment(speakerId: string, segmentIdx: number, update: Partial<SpeakerSegment>) {
		const speakers = [...this.state.speakers];
		const speakerIdx = speakers.findIndex(s => s.id === speakerId);
		if (speakerIdx === -1) return;

		const speaker = { ...speakers[speakerIdx] };
		const segments = [...speaker.segments];
		segments[segmentIdx] = { ...segments[segmentIdx], ...update };
		
		speaker.segments = segments;
		
		// Recalculate total duration if times changed
		if (update.start !== undefined || update.end !== undefined) {
			let cumulativeOffset = 0;
			speaker.segments = speaker.segments.map(s => {
				const duration = s.end - s.start;
				const sWithOffset = { ...s, mergedStart: cumulativeOffset };
				cumulativeOffset += duration;
				return sWithOffset;
			});
			speaker.totalDuration = cumulativeOffset;
		}

		speakers[speakerIdx] = speaker;
		this.state = { ...this.state, speakers };
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
