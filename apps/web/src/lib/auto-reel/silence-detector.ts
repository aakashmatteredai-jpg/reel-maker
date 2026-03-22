import { getFFmpeg } from "../media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface SilenceSegment {
	start: number;
	end: number;
}

export async function detectSilence(file: File): Promise<SilenceSegment[]> {
	const ffmpeg = await getFFmpeg();
	const inputName = "input.mp4";
	const outputName = "audio.wav";

	await ffmpeg.writeFile(inputName, await fetchFile(file));

	// Extract audio and detect silence
	// -af silencedetect=n=-30dB:d=0.5
	// -f null -
	// We need to capture logs to get silence start/end
	const silenceLogs: string[] = [];
	ffmpeg.on("log", ({ message }) => {
		if (message.includes("silencedetect")) {
			silenceLogs.push(message);
		}
	});

	await ffmpeg.exec([
		"-i", inputName,
		"-af", "silencedetect=n=-30dB:d=0.5",
		"-f", "null", "-",
	]);

	const segments: SilenceSegment[] = [];
	let currentSilenceStart: number | null = null;

	for (const log of silenceLogs) {
		const startMatch = log.match(/silence_start: ([\d.]+)/);
		const endMatch = log.match(/silence_end: ([\d.]+)/);

		if (startMatch) {
			currentSilenceStart = parseFloat(startMatch[1]);
		} else if (endMatch && currentSilenceStart !== null) {
			const end = parseFloat(endMatch[1]);
			segments.push({ start: currentSilenceStart, end });
			currentSilenceStart = null;
		}
	}

	return segments;
}

export function getSpeakingSegments(silenceSegments: SilenceSegment[], duration: number): SilenceSegment[] {
	const speaking: SilenceSegment[] = [];
	let lastEnd = 0;

	for (const silence of silenceSegments) {
		if (silence.start > lastEnd) {
			speaking.push({ start: lastEnd, end: silence.start });
		}
		lastEnd = silence.end;
	}

	if (lastEnd < duration) {
		speaking.push({ start: lastEnd, end: duration });
	}

	return speaking;
}

export function mergeSpeakingSegments(segments: SilenceSegment[], threshold = 1.0): SilenceSegment[] {
	if (segments.length === 0) return [];

	const merged: SilenceSegment[] = [segments[0]];

	for (let i = 1; i < segments.length; i++) {
		const current = segments[i];
		const last = merged[merged.length - 1];

		if (current.start - last.end < threshold) {
			last.end = current.end;
		} else {
			merged.push(current);
		}
	}

	return merged;
}

export function splitIntoClips(segments: SilenceSegment[], minDuration = 10, maxDuration = 30): SilenceSegment[] {
	const clips: SilenceSegment[] = [];

	for (const segment of segments) {
		let currentStart = segment.start;
		const totalDuration = segment.end - segment.start;

		if (totalDuration <= maxDuration) {
			if (totalDuration >= minDuration) {
				clips.push(segment);
			}
			continue;
		}

		// Split long segments
		while (currentStart < segment.end) {
			const remaining = segment.end - currentStart;
			const chunkDuration = Math.min(maxDuration, remaining);
			
			if (chunkDuration >= minDuration || clips.length === 0) {
				clips.push({ start: currentStart, end: currentStart + chunkDuration });
			}
			
			currentStart += chunkDuration;
		}
	}

	return clips;
}
