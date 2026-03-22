import { useCallback } from "react";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { 
	saveAudioBlob, 
	saveDubData, 
	clearDubData 
} from "@/lib/dub-storage";
import { mergeTranscriptWithSpeakers } from "@/lib/merge-transcript";
import { useEditor } from "./use-editor";
import type { DubState, SpeakerData, SpeakerSegment } from "@/core/managers/dub-manager";

export function useDub() {
	const editor = useEditor();
	const state = editor.dub.getState();

	const reset = useCallback(() => {
		editor.dub.reset();
		clearDubData().catch(console.error);
	}, [editor]);

	const setState = useCallback((update: Partial<DubState>) => {
		editor.dub.updateState(update);
	}, [editor]);

	const startDub = useCallback(async (videoBlob: Blob) => {
		try {
			// 1. EXTRACTION
			setState({ stage: "extracting", progress: 0, error: null });
			const ffmpeg = await getFFmpeg();
			
			await ffmpeg.writeFile("input.mp4", await fetchFile(videoBlob));
			await ffmpeg.exec([
				"-i", "input.mp4",
				"-vn",
				"-acodec", "pcm_s16le",
				"-ar", "16000",
				"-ac", "1",
				"output.wav"
			]);

			const rawAudioData = await ffmpeg.readFile("output.wav") as Uint8Array;
			const audioBlob = new Blob([rawAudioData as any], { type: "audio/wav" });
			await saveAudioBlob("raw-audio", audioBlob);

			setState({ rawAudioKey: "raw-audio", progress: 20 });

			// 2. TRANSCRIBING (Sarvam Chunked Sync API)
			setState({ stage: "transcribing", progress: 20 });
			const sarvamKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY;
			if (!sarvamKey) throw new Error("Sarvam API key (NEXT_PUBLIC_SARVAM_API_KEY) missing.");

			const CHUNK_SIZE = 25; 
			let currentOffset = 0;
			let allSarvamSegments: any[] = [];
			let chunkIdx = 0;
			let hasMore = true;

			while (hasMore) {
				const chunkFile = `chunk_${chunkIdx}.wav`;
				await ffmpeg.exec([
					"-ss", currentOffset.toString(),
					"-i", "output.wav",
					"-t", CHUNK_SIZE.toString(),
					"-c", "copy",
					chunkFile
				]);

				let chunkData: Uint8Array;
				try {
					chunkData = await ffmpeg.readFile(chunkFile) as Uint8Array;
				} catch (e) {
					hasMore = false;
					break;
				}

				if (chunkData.length < 1000) {
					hasMore = false;
					break;
				}

				const chunkBlob = new Blob([chunkData as any], { type: "audio/wav" });
				const sarvamForm = new FormData();
				sarvamForm.append("file", chunkBlob, "audio.wav");
				sarvamForm.append("language_code", "hi-IN");
				sarvamForm.append("model", "saarika:v2.5");
				sarvamForm.append("with_timestamps", "true");

				const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
					method: "POST",
					headers: { "api-subscription-key": sarvamKey },
					body: sarvamForm,
				});

				if (!sarvamRes.ok) {
					if (chunkIdx === 0) throw new Error(`Sarvam error: ${sarvamRes.statusText}`);
					hasMore = false;
					break;
				}

				const data = await sarvamRes.json();
				let chunkSegments: any[] = [];

				if (data.timestamps && data.timestamps.words && data.timestamps.words.length > 0) {
					chunkSegments = data.timestamps.words.map((text: string, i: number) => ({
						text: text,
						start: (data.timestamps.start_time_seconds?.[i] || 0) + currentOffset,
						end: (data.timestamps.end_time_seconds?.[i] || CHUNK_SIZE) + currentOffset
					}));
				} else if (Array.isArray(data.transcript)) {
					chunkSegments = data.transcript.map((s: any) => ({
						...s,
						start: (s.start || 0) + currentOffset,
						end: (s.end || 0) + currentOffset
					}));
				} else if (typeof data.transcript === "string") {
					chunkSegments = [{
						text: data.transcript,
						start: currentOffset,
						end: currentOffset + CHUNK_SIZE
					}];
				}

				allSarvamSegments = [...allSarvamSegments, ...chunkSegments];
				await ffmpeg.deleteFile(chunkFile);
				
				currentOffset += CHUNK_SIZE;
				chunkIdx++;
				setState({ progress: 20 + Math.min(18, chunkIdx * 2) });
				if (chunkIdx > 100) break; 
			}

			await saveDubData("transcript", allSarvamSegments);
			setState({ progress: 40 });

			// 3. DIARIZING (Python Proxy)
			setState({ stage: "diarizing", progress: 40 });
			const diarizeForm = new FormData();
			const fullAudioData = await ffmpeg.readFile("output.wav") as Uint8Array;
			diarizeForm.append("audio", new Blob([fullAudioData as any], { type: "audio/wav" }), "audio.wav");

			const diarizeRes = await fetch("/api/diarize", {
				method: "POST",
				body: diarizeForm,
			});

			if (!diarizeRes.ok) throw new Error(`Diarization failed: ${diarizeRes.statusText}`);
			const diarizationRaw = await diarizeRes.json();
			// result: { speakers: string[], segments: [{speaker, start, end}] }
			
			// 1. Sort raw speakers by their FIRST appearance time
			const sortedRawSpeakers = [...diarizationRaw.speakers].sort((a, b) => {
				const firstA = diarizationRaw.segments.find((s: any) => s.speaker === a)?.start || 0;
				const firstB = diarizationRaw.segments.find((s: any) => s.speaker === b)?.start || 0;
				return firstA - firstB;
			});

			// 2. Create a mapping to "Speaker 1", "Speaker 2"...
			const speakerMapping: Record<string, string> = {};
			sortedRawSpeakers.forEach((rawId, idx) => {
				speakerMapping[rawId] = `Speaker ${idx + 1}`;
			});

			// 3. Transform segments with new names
			const diarization = {
				speakers: sortedRawSpeakers.map(id => speakerMapping[id]),
				segments: diarizationRaw.segments.map((s: any) => ({
					...s,
					speaker: speakerMapping[s.speaker]
				}))
			};

			await saveDubData("diarization", diarization);

			const fullTranscript = mergeTranscriptWithSpeakers(allSarvamSegments, diarization.segments);
			await saveDubData("full-transcript", fullTranscript);

			setState({ transcript: fullTranscript, progress: 60 });

			// 4. SLICING & MERGING
			setState({ stage: "slicing", progress: 60 });
			const finalSpeakers: SpeakerData[] = [];
			const speakersList = diarization.speakers as string[];

			for (let i = 0; i < speakersList.length; i++) {
				const speakerId = speakersList[i];
				const speakerSegments = fullTranscript.filter(s => s.speaker === speakerId);
				
				if (speakerSegments.length === 0) continue;

				setState({ progress: 60 + Math.round((i / speakersList.length) * 35) });

				const segmentFiles: string[] = [];
				for (let j = 0; j < speakerSegments.length; j++) {
					const seg = speakerSegments[j];
					const segFile = `seg_${speakerId}_${j}.wav`;
					await ffmpeg.exec([
						"-i", "output.wav",
						"-ss", seg.start.toString(),
						"-to", seg.end.toString(),
						"-c", "copy",
						segFile
					]);
					segmentFiles.push(segFile);
				}

				setState({ stage: "merging" });
				const concatList = segmentFiles.map(f => `file '${f}'`).join("\n");
				await ffmpeg.writeFile(`list_${speakerId}.txt`, concatList);

				await ffmpeg.exec([
					"-f", "concat",
					"-safe", "0",
					"-i", `list_${speakerId}.txt`,
					"-c", "copy",
					`merged_${speakerId}.wav`
				]);

				const mergedData = await ffmpeg.readFile(`merged_${speakerId}.wav`) as Uint8Array;
				const mergedBlob = new Blob([mergedData as any], { type: "audio/wav" });
				const mergedKey = `speaker-${speakerId}-audio`;
				await saveAudioBlob(mergedKey, mergedBlob);

				let cumulativeOffset = 0;
				const segmentsWithOffsets = speakerSegments.map(s => {
					const duration = s.end - s.start;
					const sWithOffset = { ...s, mergedStart: cumulativeOffset };
					cumulativeOffset += duration;
					return sWithOffset;
				});

				const speakerData: SpeakerData = {
					id: speakerId,
					segments: segmentsWithOffsets,
					mergedAudioKey: mergedKey,
					totalDuration: cumulativeOffset,
				};

				await saveDubData(`speaker-${speakerId}-data`, speakerData);
				finalSpeakers.push(speakerData);
			}

			setState({
				stage: "done",
				progress: 100,
				speakers: finalSpeakers,
			});

		} catch (error) {
			console.error("Dubbing pipeline error:", error);
			setState({
				stage: "error",
				error: error instanceof Error ? error.message : "An unknown error occurred.",
			});
		}
	}, [editor, setState]);

	return {
		state,
		startDub,
		reset,
	};
}
