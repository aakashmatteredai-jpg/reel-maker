import type { SpeakerSegment } from "../hooks/use-dub";

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
				
				// Overlap if duration is positive and either > 0.5s or > 50% of the sarvam segment
				const sarvamDuration = sarvam.end - sarvam.start;
				return overlapDuration > 0 && (overlapDuration > 0.5 || overlapDuration > sarvamDuration * 0.5);
			})
			.map((s) => s.text)
			.join(" ")
			.trim();

		result.push({
			speaker: diar.speaker,
			start: diar.start,
			end: diar.end,
			text: overlappingText,
		});
	}

	// Sort by start time for chronological order
	return result.sort((a, b) => a.start - b.start);
}
