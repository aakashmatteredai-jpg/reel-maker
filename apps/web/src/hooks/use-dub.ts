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

			// 2. DIARIZING (Python Proxy)
			setState({ stage: "diarizing", progress: 20 });
			const diarizeForm = new FormData();
			const fullAudioData = await ffmpeg.readFile("output.wav") as Uint8Array;
			diarizeForm.append("audio", new Blob([fullAudioData as any], { type: "audio/wav" }), "audio.wav");

			const diarizeRes = await fetch("/api/diarize", {
				method: "POST",
				body: diarizeForm,
			});

			if (!diarizeRes.ok) throw new Error(`Diarization failed: ${diarizeRes.statusText}`);
			const diarizationRaw = await diarizeRes.json();
			
			// Sort and Rename speakers
			const sortedRawSpeakers = [...diarizationRaw.speakers].sort((a, b) => {
				const firstA = diarizationRaw.segments.find((s: any) => s.speaker === a)?.start || 0;
				const firstB = diarizationRaw.segments.find((s: any) => s.speaker === b)?.start || 0;
				return firstA - firstB;
			});

			const speakerMapping: Record<string, string> = {};
			sortedRawSpeakers.forEach((rawId, idx) => {
				speakerMapping[rawId] = `Speaker ${idx + 1}`;
			});

			const diarizedSegments = diarizationRaw.segments.map((s: any) => ({
				...s,
				speaker: speakerMapping[s.speaker]
			}));

			await saveDubData("diarization", { speakers: Object.values(speakerMapping), segments: diarizedSegments });
			setState({ progress: 40 });

			// 3. TRANSCRIBING per segment
			setState({ stage: "transcribing", progress: 40 });
			const sarvamKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY;
			if (!sarvamKey) throw new Error("Sarvam API key missing.");

			const fullTranscript: SpeakerSegment[] = [];
			for (let i = 0; i < diarizedSegments.length; i++) {
				const seg = diarizedSegments[i];
				const segFile = `transcribe_seg_${i}.wav`;
				
				// Slice audio for this segment
				await ffmpeg.exec([
					"-i", "output.wav",
					"-ss", seg.start.toString(),
					"-to", seg.end.toString(),
					"-c", "copy",
					segFile
				]);

				const segData = await ffmpeg.readFile(segFile) as Uint8Array;
				if (segData.length > 1000) {
					const segBlob = new Blob([segData as any], { type: "audio/wav" });
					const sarvamForm = new FormData();
					sarvamForm.append("file", segBlob, "audio.wav");
					sarvamForm.append("language_code", "hi-IN");
					sarvamForm.append("model", "saarika:v2.5");

					try {
						const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
							method: "POST",
							headers: { "api-subscription-key": sarvamKey },
							body: sarvamForm,
						});

						if (sarvamRes.ok) {
							const data = await sarvamRes.json();
							fullTranscript.push({
								speaker: seg.speaker,
								start: seg.start,
								end: seg.end,
								text: data.transcript || "",
							});
						} else {
							fullTranscript.push({ ...seg, text: "" });
						}
					} catch (e) {
						fullTranscript.push({ ...seg, text: "" });
					}
				} else {
					fullTranscript.push({ ...seg, text: "" });
				}

				await ffmpeg.deleteFile(segFile);
				setState({ progress: 40 + Math.round((i / diarizedSegments.length) * 30) });
			}

			await saveDubData("full-transcript", fullTranscript);
			setState({ transcript: fullTranscript, progress: 70 });

			// 4. SLICING & MERGING for final playback
			setState({ stage: "slicing", progress: 70 });
			const finalSpeakers: SpeakerData[] = [];
			const speakersList = Object.values(speakerMapping);

			for (let i = 0; i < speakersList.length; i++) {
				const speakerId = speakersList[i];
				const speakerSegments = fullTranscript.filter(s => s.speaker === speakerId);
				
				if (speakerSegments.length === 0) continue;

				setState({ progress: 70 + Math.round((i / speakersList.length) * 25) });

				const segmentFiles: string[] = [];
				for (let j = 0; j < speakerSegments.length; j++) {
					const seg = speakerSegments[j];
					const segFile = `final_seg_${speakerId}_${j}.wav`;
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
