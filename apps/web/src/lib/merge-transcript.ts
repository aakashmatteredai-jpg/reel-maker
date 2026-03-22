import type { SpeakerSegment } from "../core/managers/dub-manager";

/**
 * Merges Sarvam transcript segments with Pyannote diarization segments.
 * 
 * Logic: For each diarization segment, find all Sarvam transcript segments
 * that overlap with the [start, end] range (overlap threshold: 0.5s or significant percentage).
 */
export function mergeTranscriptWithSpeakers(
	sarvamSegments: Array<{ start: number; end: number; text: string }>,
	diarizationSegments: Array<{ speaker: string; start: number; end: number }>
): SpeakerSegment[] {
	const result: SpeakerSegment[] = [];

	for (const diar of diarizationSegments) {
		const overlappingText = sarvamSegments
			.filter((sarvam) => {
				const overlapStart = Math.max(diar.start, sarvam.start);
				const overlapEnd = Math.min(diar.end, sarvam.end);
				const overlapDuration = overlapEnd - overlapStart;
				
				if (overlapDuration <= 0) return false;

				const sarvamDuration = sarvam.end - sarvam.start;
				
				// Standard: Significant overlap (>0.5s or >50%)
				if (overlapDuration > 0.5 || overlapDuration > sarvamDuration * 0.5) return true;

				// Fallback: If Sarvam segment is a large block (common in sync API for long chunks),
				// and our tiny diarization segment falls completely inside it, we take it.
				if (sarvamDuration > 5 && diar.start >= sarvam.start - 0.5 && diar.end <= sarvam.end + 0.5) return true;

				return false;
			})
			.map((s) => s.text)
			.join(" ")
			.trim();

		result.push({
			speaker: diar.speaker,
			start: diar.start,
			end: diar.end,
			text: overlappingText || undefined,
		});
	}

	// Sort by start time for chronological order
	return result.sort((a, b) => a.start - b.start);
}
