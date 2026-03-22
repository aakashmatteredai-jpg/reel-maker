import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { generateSpeech } from "@/lib/ai/voiceover";
import type { DubbingSpeaker, DubbingSegment } from "@/types/transcription";
import { translateText } from "@/lib/ai/translation";

/**
 * Renders the final dubbed audio track and returns a Blob URL.
 */
export async function renderDubbedTrack(
	speakers: DubbingSpeaker[],
	onProgress?: (progress: string) => void
): Promise<string> {
	const ffmpeg = await getFFmpeg();
	onProgress?.("Generating TTS for segments...");

	const dubbedChunks: { segment: DubbingSegment; audioBlob: Blob }[] = [];

	// Step 1: Generate TTS for all segments
	for (const speaker of speakers) {
		if (!speaker.ttsVoiceId || !speaker.ttsProvider) continue;

		for (const seg of speaker.segments) {
			try {
				const translated = await translateText(seg.text, "Hindi"); // Example target
				const audioBlob = await generateSpeech(speaker.ttsProvider, translated, speaker.ttsVoiceId);
				dubbedChunks.push({ segment: seg, audioBlob });
			} catch (err) {
				console.error("TTS generation failed for segment:", seg, err);
			}
		}
	}

	onProgress?.("Merging dubbed audio track...");

	// Step 2: Overlay chunks onto a silent track using ffmpeg
	// We'll create a silent track of the same duration as the video
	const totalDuration = Math.max(...speakers.flatMap(s => s.segments).map(seg => seg.end), 0) + 1;
	
	await ffmpeg.exec([
		"-f", "lavfi",
		"-i", `anullsrc=r=16000:cl=mono`,
		"-t", String(totalDuration),
		"background_silence.wav"
	]);

	let currentTrack = "background_silence.wav";

	for (let i = 0; i < dubbedChunks.length; i++) {
		const { segment, audioBlob } = dubbedChunks[i];
		const chunkName = `chunk_${i}.wav`;
		const nextTrack = `track_${i}.wav`;

		await ffmpeg.writeFile(chunkName, await fetchFile(audioBlob));

		// Use amix or overlay logic
		// simpler: -filter_complex "adelay=timestamp|timestamp"
		const delayMs = Math.round(segment.start * 1000);
		
		await ffmpeg.exec([
			"-i", currentTrack,
			"-i", chunkName,
			"-filter_complex", `[1:a]adelay=${delayMs}|${delayMs}[delayed];[0:a][delayed]amix=inputs=2:duration=first[out]`,
			"-map", "[out]",
			nextTrack
		]);

		currentTrack = nextTrack;
	}

	const finalData = await ffmpeg.readFile(currentTrack) as Uint8Array;
	return URL.createObjectURL(new Blob([finalData.buffer as ArrayBuffer], { type: "audio/wav" }));
}
