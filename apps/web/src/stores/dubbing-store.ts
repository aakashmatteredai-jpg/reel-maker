import { create } from "zustand";
import type { Character, DubbingSegment, DubbingProject, DubbingSpeaker } from "@/types/transcription";
import { loadProjects, saveProject, deleteProject as deleteProjectFromStorage, createProject } from "@/lib/dubbing/dubbing-projects";

export interface DubbingStore {
	// Project management
	projects: DubbingProject[];
	activeProjectId: string | null;

	// Current working state
	characters: Character[];
	segments: DubbingSegment[];
	speakers: DubbingSpeaker[];
	isDiarizing: boolean;
	isDubbing: boolean;
	playingSpeakerId: string | null;
	timelineMode: boolean; // Global toggle: Speaker Audio vs Original Video

	// Project actions
	loadAllProjects: () => void;
	setActiveProject: (id: string) => void;
	createAndActivateProject: (name: string, speakers: DubbingSpeaker[], segments: DubbingSegment[], videoUrl?: string) => DubbingProject;
	saveCurrentProject: () => void;
	removeProject: (id: string) => void;

	// State setters
	setCharacters: (characters: Character[]) => void;
	updateCharacter: (id: string, updates: Partial<Character>) => void;
	setSpeakers: (speakers: DubbingSpeaker[]) => void;
	updateSpeaker: (id: string, updates: Partial<DubbingSpeaker>) => void;
	setSegments: (segments: DubbingSegment[]) => void;
	updateSegment: (index: number, updates: Partial<DubbingSegment>) => void;
	updateSegmentText: (speakerId: string, segIndex: number, newText: string) => void;
	confirmSpeaker: (id: string) => void;
	unconfirmSpeaker: (id: string) => void;
	allSpeakersConfirmed: () => boolean;
	setIsDiarizing: (isDiarizing: boolean) => void;
	setIsDubbing: (isDubbing: boolean) => void;
	setPlayingSpeakerId: (id: string | null) => void;
	setTimelineMode: (enabled: boolean) => void;

	resetDubbing: () => void;
}

export const useDubbingStore = create<DubbingStore>()((set, get) => ({
	projects: [],
	activeProjectId: null,

	characters: [],
	segments: [],
	speakers: [],
	isDiarizing: false,
	isDubbing: false,
	playingSpeakerId: null,
	timelineMode: false,

	// --- Project management ---

	loadAllProjects: () => {
		const projects = loadProjects();
		set({ projects });
	},

	setActiveProject: (id) => {
		const project = loadProjects().find((p) => p.id === id);
		if (!project) return;

		// Reconstruct characters from speakers for backward compat
		const characters: Character[] = project.speakers.map((s) => ({
			id: s.id,
			name: s.name,
			gender: s.gender,
			ttsVoiceId: s.ttsVoiceId,
			ttsProvider: s.ttsProvider,
			totalDuration: s.totalDuration,
			color: s.color,
		}));

		set({
			activeProjectId: id,
			speakers: project.speakers,
			segments: project.originalSegments,
			characters,
		});
	},

	createAndActivateProject: (name, speakers, segments, videoUrl) => {
		const project = createProject(name, speakers, segments, videoUrl);
		const projects = loadProjects();

		const characters: Character[] = speakers.map((s) => ({
			id: s.id,
			name: s.name,
			gender: s.gender,
			ttsVoiceId: s.ttsVoiceId,
			ttsProvider: s.ttsProvider,
			totalDuration: s.totalDuration,
			color: s.color,
		}));

		set({
			projects,
			activeProjectId: project.id,
			speakers,
			segments,
			characters,
		});

		return project;
	},

	saveCurrentProject: () => {
		const state = get();
		if (!state.activeProjectId) return;

		const existing = loadProjects().find((p) => p.id === state.activeProjectId);
		if (!existing) return;

		// Sync speakers from characters
		const updatedSpeakers: DubbingSpeaker[] = state.speakers.map((s) => {
			const char = state.characters.find((c) => c.id === s.id);
			return {
				...s,
				name: char?.name || s.name,
				gender: char?.gender || s.gender,
				ttsVoiceId: char?.ttsVoiceId || s.ttsVoiceId,
				ttsProvider: char?.ttsProvider || s.ttsProvider,
			};
		});

		const updated: DubbingProject = {
			...existing,
			speakers: updatedSpeakers,
			originalSegments: state.segments,
			settings: {
				...existing.settings,
				selectedVoices: Object.fromEntries(
					updatedSpeakers
						.filter((s) => s.ttsVoiceId)
						.map((s) => [s.id, { voiceId: s.ttsVoiceId!, provider: s.ttsProvider || "elevenlabs" }])
				),
			},
		};

		saveProject(updated);
		set({ projects: loadProjects() });
	},

	removeProject: (id) => {
		deleteProjectFromStorage(id);
		const state = get();
		const projects = loadProjects();

		if (state.activeProjectId === id) {
			set({ projects, activeProjectId: null, speakers: [], segments: [], characters: [] });
		} else {
			set({ projects });
		}
	},

	// --- State setters ---

	setCharacters: (characters) => set({ characters }),
	updateCharacter: (id, updates) => {
		set((state) => ({
			characters: state.characters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
		}));
		// Auto-save after character change
		setTimeout(() => get().saveCurrentProject(), 0);
	},
	setSpeakers: (speakers) => set({ speakers }),
	updateSpeaker: (id, updates) => {
		set((state) => ({
			speakers: state.speakers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
		}));
		setTimeout(() => get().saveCurrentProject(), 0);
	},
	setSegments: (segments) => set({ segments }),
	updateSegment: (index, updates) =>
		set((state) => {
			const newSegments = [...state.segments];
			if (newSegments[index]) {
				newSegments[index] = { ...newSegments[index]!, ...updates };
			}
			return { segments: newSegments };
		}),
	updateSegmentText: (speakerId, segIndex, newText) => {
		set((state) => {
			const newSpeakers = state.speakers.map((s) => {
				if (s.id !== speakerId) return s;
				const newSegs = [...s.segments];
				if (newSegs[segIndex]) {
					newSegs[segIndex] = { ...newSegs[segIndex]!, text: newText };
				}
				const fullText = newSegs.map(seg => seg.text).join(" ");
				return { ...s, segments: newSegs, fullText };
			});
			// Also update the main segments array
			const speaker = state.speakers.find(sp => sp.id === speakerId);
			if (speaker && speaker.segments[segIndex]) {
				const globalIdx = state.segments.findIndex(
					sg => sg.start === speaker.segments[segIndex].start && sg.speakerId === speakerId
				);
				if (globalIdx >= 0) {
					const newSegments = [...state.segments];
					newSegments[globalIdx] = { ...newSegments[globalIdx]!, text: newText };
					return { speakers: newSpeakers, segments: newSegments };
				}
			}
			return { speakers: newSpeakers };
		});
		setTimeout(() => get().saveCurrentProject(), 0);
	},
	confirmSpeaker: (id) => {
		set((state) => ({
			speakers: state.speakers.map((s) => s.id === id ? { ...s, confirmed: true } : s),
		}));
		setTimeout(() => get().saveCurrentProject(), 0);
	},
	unconfirmSpeaker: (id) => {
		set((state) => ({
			speakers: state.speakers.map((s) => s.id === id ? { ...s, confirmed: false } : s),
		}));
		setTimeout(() => get().saveCurrentProject(), 0);
	},
	allSpeakersConfirmed: () => {
		const state = get();
		return state.speakers.length > 0 && state.speakers.every((s) => s.confirmed);
	},
	setIsDiarizing: (isDiarizing) => set({ isDiarizing }),
	setIsDubbing: (isDubbing) => set({ isDubbing }),
	setPlayingSpeakerId: (id) => set({ playingSpeakerId: id }),
	setTimelineMode: (enabled) => {
		set({ timelineMode: enabled });
	},

	resetDubbing: () =>
		set({
			characters: [],
			segments: [],
			speakers: [],
			isDiarizing: false,
			isDubbing: false,
			activeProjectId: null,
			playingSpeakerId: null,
			timelineMode: false,
		}),
}));
