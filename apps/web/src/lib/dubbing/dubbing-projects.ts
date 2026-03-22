import type { DubbingProject, DubbingSegment, DubbingSpeaker } from "@/types/transcription";

const STORAGE_KEY = "reel_dubbing_projects";
const MAX_PROJECTS = 10;

function generateId(): string {
	return `dub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Strips non-serializable fields (Blob URLs) before saving.
 */
function serializeProject(project: DubbingProject): DubbingProject {
	return {
		...project,
		videoUrl: undefined, // Blob URLs can't be persisted
		speakers: project.speakers.map((s) => ({
			...s,
			audioUrl: undefined, // Blob URLs can't be persisted
		})),
	};
}

/**
 * Load all saved dubbing projects from localStorage.
 */
export function loadProjects(): DubbingProject[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as DubbingProject[];
	} catch {
		return [];
	}
}

/**
 * Save a project. Creates new if no existing id, otherwise updates.
 * Enforces max project limit by removing oldest.
 */
export function saveProject(project: DubbingProject): DubbingProject {
	const projects = loadProjects();
	const idx = projects.findIndex((p) => p.id === project.id);

	const serialized = serializeProject(project);

	if (idx >= 0) {
		projects[idx] = serialized;
	} else {
		projects.push(serialized);
	}

	// Enforce max limit — remove oldest first
	while (projects.length > MAX_PROJECTS) {
		projects.sort((a, b) => a.createdAt - b.createdAt);
		projects.shift();
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	} catch (e) {
		console.error("Failed to save dubbing project to localStorage:", e);
	}

	return project;
}

/**
 * Create a new dubbing project from diarization results.
 */
export function createProject(
	name: string,
	speakers: DubbingSpeaker[],
	originalSegments: DubbingSegment[],
	videoUrl?: string
): DubbingProject {
	const project: DubbingProject = {
		id: generateId(),
		name,
		createdAt: Date.now(),
		videoUrl,
		speakers,
		originalSegments,
		settings: {
			captionsEnabled: true,
			selectedVoices: {},
		},
	};

	return saveProject(project);
}

/**
 * Get a single project by ID.
 */
export function getProjectById(id: string): DubbingProject | undefined {
	return loadProjects().find((p) => p.id === id);
}

/**
 * Delete a project by ID.
 */
export function deleteProject(id: string): void {
	const projects = loadProjects().filter((p) => p.id !== id);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	} catch (e) {
		console.error("Failed to delete dubbing project:", e);
	}
}
