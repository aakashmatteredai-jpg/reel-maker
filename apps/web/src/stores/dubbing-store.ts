import { create } from "zustand";
import type { Character, DubbingSegment } from "@/types/transcription";

export interface DubbingStore {
	characters: Character[];
	segments: DubbingSegment[];
	isDiarizing: boolean;
	isDubbing: boolean;
	
	setCharacters: (characters: Character[]) => void;
	updateCharacter: (id: string, updates: Partial<Character>) => void;
	setSegments: (segments: DubbingSegment[]) => void;
	updateSegment: (index: number, updates: Partial<DubbingSegment>) => void;
	setIsDiarizing: (isDiarizing: boolean) => void;
	setIsDubbing: (isDubbing: boolean) => void;
	
	resetDubbing: () => void;
}

export const useDubbingStore = create<DubbingStore>()((set) => ({
	characters: [],
	segments: [],
	isDiarizing: false,
	isDubbing: false,

	setCharacters: (characters) => set({ characters }),
	updateCharacter: (id, updates) => set((state) => ({
		characters: state.characters.map((c) => c.id === id ? { ...c, ...updates } : c)
	})),
	setSegments: (segments) => set({ segments }),
	updateSegment: (index, updates) => set((state) => {
		const newSegments = [...state.segments];
		if (newSegments[index]) {
			newSegments[index] = { ...newSegments[index]!, ...updates };
		}
		return { segments: newSegments };
	}),
	setIsDiarizing: (isDiarizing) => set({ isDiarizing }),
	setIsDubbing: (isDubbing) => set({ isDubbing }),
	
	resetDubbing: () => set({ characters: [], segments: [], isDiarizing: false, isDubbing: false }),
}));
