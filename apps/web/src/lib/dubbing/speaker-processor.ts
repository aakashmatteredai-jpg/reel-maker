import type { DubbingSegment, DubbingSpeaker } from "@/types/transcription";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const SPEAKER_COLORS = [
	"#ef4444", "#3b82f6", "#10b981", "#f59e0b",
	"#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

/**
 * Groups raw diarization segments into speaker buckets.
 */
export function groupSegmentsBySpeaker(
	segments: DubbingSegment[]
): Record<string, { segments: DubbingSegment[]; fullText: string; totalDuration: number }> {
	const groups: Record<string, { segments: DubbingSegment[]; fullText: string; totalDuration: number }> = {};

	for (const seg of segments) {
		const id = seg.speakerId || "unknown";
		if (!groups[id]) {
			groups[id] = { segments: [], fullText: "", totalDuration: 0 };
		}
		groups[id].segments.push(seg);
		groups[id].fullText += (groups[id].fullText ? " " : "") + seg.text;
		groups[id].totalDuration += seg.end - seg.start;
	}

	return groups;
}

/**
 * Extracts audio for a single speaker by cutting and concatenating their segments.
 * Uses ffmpeg.wasm (already loaded in the project).
 */
export async function extractSpeakerAudio(
	videoFile: File | Blob,
	segments: DubbingSegment[]
): Promise<string> {
	const ffmpeg = await getFFmpeg();
	const inputName = "input_dub.mp4";

	await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

	// Cut each segment and produce individual WAV chunks
	const chunkNames: string[] = [];
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const outName = `chunk_${i}.wav`;
		chunkNames.push(outName);

		await ffmpeg.exec([
			"-i", inputName,
			"-ss", String(seg.start),
			"-to", String(seg.end),
			"-vn",
			"-acodec", "pcm_s16le",
			"-ar", "16000",
			"-ac", "1",
			outName,
		]);
	}

	// If only one chunk, skip concatenation
	if (chunkNames.length === 1) {
		const data = await ffmpeg.readFile(chunkNames[0]) as Uint8Array;
		// Cleanup
		await ffmpeg.deleteFile(inputName);
		await ffmpeg.deleteFile(chunkNames[0]);
		return URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: "audio/wav" }));
	}

	// Build a concat file list
	const listContent = chunkNames.map((n) => `file '${n}'`).join("\n");
	await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(listContent));

	const mergedName = "merged_speaker.wav";
	await ffmpeg.exec([
		"-f", "concat",
		"-safe", "0",
		"-i", "concat_list.txt",
		"-acodec", "pcm_s16le",
		"-ar", "16000",
		"-ac", "1",
		mergedName,
	]);

	const mergedData = (await ffmpeg.readFile(mergedName)) as Uint8Array;

	// Cleanup temp files
	await ffmpeg.deleteFile(inputName);
	await ffmpeg.deleteFile("concat_list.txt");
	await ffmpeg.deleteFile(mergedName);
	for (const name of chunkNames) {
		await ffmpeg.deleteFile(name).catch(() => {});
	}

	return URL.createObjectURL(new Blob([mergedData.buffer as ArrayBuffer], { type: "audio/wav" }));
}

/**
 * Builds complete speaker profiles from diarization segments.
 * Optionally extracts per-speaker audio if a video file is provided.
 */
export async function buildSpeakerProfiles(
	segments: DubbingSegment[],
	videoFile?: File | Blob
): Promise<DubbingSpeaker[]> {
	const groups = groupSegmentsBySpeaker(segments);
	const speakerIds = Object.keys(groups);

	const speakers: DubbingSpeaker[] = [];

	for (let i = 0; i < speakerIds.length; i++) {
		const id = speakerIds[i];
		const group = groups[id];

		let audioUrl: string | undefined;
		if (videoFile) {
			try {
				audioUrl = await extractSpeakerAudio(videoFile, group.segments);
			} catch (err) {
				console.warn(`Failed to extract audio for speaker ${id}:`, err);
			}
		}

		const gender = group.segments[0]?.gender || "neutral";

		speakers.push({
			id,
			name: `Speaker ${i + 1}`,
			gender,
			color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
			segments: group.segments,
			fullText: group.fullText,
			totalDuration: group.totalDuration,
			audioUrl,
		});
	}

	return speakers;
}
