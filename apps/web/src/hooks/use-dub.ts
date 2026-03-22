import { useState, useCallback } from "react";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { 
	saveAudioBlob, 
	saveDubData, 
	clearDubData 
} from "@/lib/dub-storage";
import { mergeTranscriptWithSpeakers } from "@/lib/merge-transcript";

export type DubStage =
	| "idle"
	| "extracting"
	| "transcribing"
	| "diarizing"
	| "slicing"
	| "merging"
	| "done"
	| "error";

export interface SpeakerSegment {
	speaker: string;
	start: number;
	end: number;
	text?: string;
	mergedStart?: number; // Offset in the merged audio file
}

export interface SpeakerData {
	id: string;
	segments: SpeakerSegment[];
	mergedAudioKey: string;
	totalDuration: number;
}

export interface DubState {
	stage: DubStage;
	progress: number;
	error: string | null;
	speakers: SpeakerData[];
	transcript: SpeakerSegment[];
	rawAudioKey: string | null;
}

const INITIAL_STATE: DubState = {
	stage: "idle",
	progress: 0,
	error: null,
	speakers: [],
	transcript: [],
	rawAudioKey: null,
};

export function useDub() {
	const [state, setState] = useState<DubState>(INITIAL_STATE);

	const reset = useCallback(() => {
		setState(INITIAL_STATE);
		clearDubData().catch(console.error);
	}, []);

	const startDub = useCallback(async (videoBlob: Blob) => {
		try {
			// 1. EXTRACTION
			setState(prev => ({ ...prev, stage: "extracting", progress: 0 }));
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

			setState(prev => ({ ...prev, rawAudioKey: "raw-audio", progress: 20 }));

			// 2. TRANSCRIBING (Sarvam)
			setState(prev => ({ ...prev, stage: "transcribing", progress: 20 }));
			const sarvamKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY;
			if (!sarvamKey) throw new Error("Sarvam API key (NEXT_PUBLIC_SARVAM_API_KEY) missing.");

			const sarvamForm = new FormData();
			sarvamForm.append("file", audioBlob, "audio.wav");
			sarvamForm.append("language_code", "hi-IN");
			sarvamForm.append("model", "saarika:v2.5");
			sarvamForm.append("with_timestamps", "true");

			const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
				method: "POST",
				headers: { "api-subscription-key": sarvamKey },
				body: sarvamForm,
			});

			if (!sarvamRes.ok) throw new Error(`Sarvam error: ${sarvamRes.statusText}`);
			const sarvamData = await sarvamRes.json();
			// Assume sarvamData has { transcript: Array<{start, end, text}> }
			const sarvamSegments = sarvamData.transcript || [];
			await saveDubData("transcript", sarvamSegments);

			setState(prev => ({ ...prev, progress: 40 }));

			// 3. DIARIZING (Python Proxy)
			setState(prev => ({ ...prev, stage: "diarizing", progress: 40 }));
			const diarizeForm = new FormData();
			diarizeForm.append("audio", audioBlob, "audio.wav");

			const diarizeRes = await fetch("/api/diarize", {
				method: "POST",
				body: diarizeForm,
			});

			if (!diarizeRes.ok) throw new Error(`Diarization failed: ${diarizeRes.statusText}`);
			const diarization = await diarizeRes.json();
			// result: { speakers: string[], segments: [{speaker, start, end}] }
			await saveDubData("diarization", diarization);

			// Merge Sarvam text with Diarization segments
			const fullTranscript = mergeTranscriptWithSpeakers(sarvamSegments, diarization.segments);
			await saveDubData("full-transcript", fullTranscript);

			setState(prev => ({ ...prev, transcript: fullTranscript, progress: 60 }));

			// 4. SLICING & MERGING
			setState(prev => ({ ...prev, stage: "slicing", progress: 60 }));
			const finalSpeakers: SpeakerData[] = [];
			const speakersList = diarization.speakers as string[];

			for (let i = 0; i < speakersList.length; i++) {
				const speakerId = speakersList[i];
				const speakerSegments = fullTranscript.filter(s => s.speaker === speakerId);
				
				if (speakerSegments.length === 0) continue;

				setState(prev => ({ 
					...prev, 
					progress: 60 + Math.round((i / speakersList.length) * 35) 
				}));

				// Slice each segment
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

				// Merge segments for this speaker
				setState(prev => ({ ...prev, stage: "merging" }));
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

				// Calculate relative offsets for merged playback
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

			setState(prev => ({
				...prev,
				stage: "done",
				progress: 100,
				speakers: finalSpeakers,
			}));

		} catch (error) {
			console.error("Dubbing pipeline error:", error);
			setState(prev => ({
				...prev,
				stage: "error",
				error: error instanceof Error ? error.message : "An unknown error occurred.",
			}));
		}
	}, []);

	return {
		state,
		startDub,
		reset,
	};
}
