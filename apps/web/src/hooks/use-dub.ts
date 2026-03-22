import { useCallback, useEffect } from "react";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { 
	saveAudioBlob, 
	getAudioBlob,
	saveDubData, 
	getDubData,
	clearDubData 
} from "@/lib/dub-storage";
import { mergeTranscriptWithSpeakers } from "@/lib/merge-transcript";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import { buildEmptyTrack } from "@/lib/timeline/track-utils";
import { generateUUID } from "@/utils/id";
import { useEditor } from "./use-editor";
import { toast } from "sonner";
import type { DubState, SpeakerData, SpeakerSegment } from "@/core/managers/dub-manager";

export function useDub(assetId?: string) {
	const editor = useEditor();
	const state = editor.dub.getState();

	const reset = useCallback(() => {
		editor.dub.reset();
		if (assetId) {
			saveDubData(`dub-state-${assetId}`, null).catch(console.error);
		}
		clearDubData().catch(console.error);
	}, [editor, assetId]);

	const setState = useCallback((update: Partial<DubState>) => {
		editor.dub.updateState(update);
		
		// Persist state if it's done or has speakers
		if (assetId && (update.stage === "done" || update.speakers || update.transcript)) {
			const currentState = editor.dub.getState();
			saveDubData(`dub-state-${assetId}`, currentState).catch(console.error);
		}
	}, [editor, assetId]);

	// Auto-load state on mount or assetId change
	useEffect(() => {
		if (assetId) {
			getDubData(`dub-state-${assetId}`).then((saved) => {
				if (saved && typeof saved === "object") {
					editor.dub.updateState(saved as DubState);
				} else {
					editor.dub.reset();
				}
			});
		}
	}, [assetId, editor]);

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

	const translateTranscript = useCallback(async (targetLang: string) => {
		const currentState = editor.dub.getState();
		if (!currentState.transcript.length) return;

		setState({ stage: "transcribing", progress: 0 }); // Reuse transcribing or add translating
		const translated: SpeakerSegment[] = [];

		for (let i = 0; i < currentState.transcript.length; i++) {
			const seg = currentState.transcript[i];
			if (!seg.text) {
				translated.push({ ...seg, text: "" });
				continue;
			}

			try {
				const res = await fetch("/api/translate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: seg.text,
						targetLanguage: targetLang,
						provider: "groq"
					})
				});
				const data = await res.json();
				translated.push({ ...seg, text: data.translatedText || seg.text });
			} catch (e) {
				translated.push({ ...seg, text: seg.text });
			}
			setState({ progress: Math.round((i / currentState.transcript.length) * 100) });
		}

		setState({ 
			targetTranscript: translated, 
			targetLanguage: targetLang,
			stage: "done", // Mark as done for this step
			progress: 100 
		});
	}, [editor, setState]);

	const generateDub = useCallback(async () => {
		const currentState = editor.dub.getState();
		if (!currentState.targetTranscript || !currentState.targetTranscript.length) return;

		setState({ stage: "dubbing", progress: 0 });
		
		const dubbedTranscript = [...currentState.targetTranscript];
		const speakers = currentState.speakers;

		for (let i = 0; i < dubbedTranscript.length; i++) {
			const seg = dubbedTranscript[i];
			const speaker = speakers.find(s => s.id === seg.speaker);
			
			if (!speaker || !speaker.voiceId || !speaker.voiceProvider || !seg.text) {
				setState({ progress: Math.round((i / dubbedTranscript.length) * 100) });
				continue;
			}

			// Skip if already dubbed (user can clear keys by changing voice)
			if (seg.dubbedAudioKey) {
				setState({ progress: Math.round((i / dubbedTranscript.length) * 100) });
				continue;
			}

			try {
				const res = await fetch("/api/tts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: seg.text,
						voiceId: speaker.voiceId,
						provider: speaker.voiceProvider,
						languageCode: currentState.targetLanguage
					})
				});
				
				if (res.ok) {
					const audioBlob = await res.blob();
					if (audioBlob.size < 100) {
						console.warn("TTS returned suspiciously small blob:", i, audioBlob.size);
						throw new Error("Invalid audio data from TTS");
					}
					const key = `dubbed-${assetId || "temp"}-${i}-${speaker.id}`;
					await saveAudioBlob(key, audioBlob);
					dubbedTranscript[i] = { ...seg, dubbedAudioKey: key };
				} else {
					const errText = await res.text();
					console.error("TTS API error:", res.status, errText);
					throw new Error(`TTS API failed: ${res.status}`);
				}
			} catch (e) {
				console.error("TTS failed for segment:", i, e);
			}

			setState({ progress: Math.round((i / dubbedTranscript.length) * 100) });
		}

		setState({ 
			targetTranscript: dubbedTranscript, 
			stage: "done", 
			progress: 100 
		});
		toast.success("Dubbing generated successfully!");
	}, [editor, setState, assetId]);

	const applyToTimeline = useCallback(async () => {
		const currentState = editor.dub.getState();
		if (!currentState.targetTranscript || currentState.targetTranscript.length === 0) {
			toast.error("No dubbed audio to apply!");
			return;
		}

		const activeProject = editor.project.getActiveOrNull();
		if (!activeProject) {
			toast.error("No active project!");
			return;
		}

		setState({ stage: "merging", progress: 0 });

		// 1. Prepare segments and assets
		const assetsToUpload: any[] = [];
		const segmentsWithAudioIndices: number[] = [];

		for (let i = 0; i < currentState.targetTranscript.length; i++) {
			const seg = currentState.targetTranscript[i];
			if (!seg.dubbedAudioKey) continue;

			try {
				const blob = await getAudioBlob(seg.dubbedAudioKey);
				if (!blob || blob.size < 100) continue;

				const extension = blob.type.includes("wav") ? "wav" : "mp3";
				const file = new File([blob], `dub-${i}.${extension}`, { type: blob.type });
				
				assetsToUpload.push({
					name: `Dub Speaker ${seg.speaker} - ${i}`,
					type: "audio",
					file: file,
					url: URL.createObjectURL(file),
					duration: seg.end - seg.start,
				});
				segmentsWithAudioIndices.push(i);
			} catch (err) {
				console.error("Failed to prepare segment:", i, err);
			}
		}

		if (assetsToUpload.length === 0) {
			setState({ stage: "done", progress: 100 });
			toast.info("No dubbed audio to apply.");
			return;
		}

		// 2. Batch Add to Media Manager
		const mediaIds = await editor.media.addMediaAssets({
			projectId: activeProject.metadata.id,
			assets: assetsToUpload
		});

		// 3. Batch Add to Timeline
		const tracksBefore = editor.timeline.getTracks();
		const dubTrackId = generateUUID();
		const dubTrack = buildEmptyTrack({ id: dubTrackId, type: "audio" });
		dubTrack.name = "AI Dubbed Voice";

		const elements = segmentsWithAudioIndices.map((origIdx, batchIdx) => {
			const seg = currentState.targetTranscript![origIdx];
			const mediaId = mediaIds[batchIdx];
			const duration = seg.end - seg.start;
			
			return buildElementFromMedia({
				mediaId,
				mediaType: "audio",
				name: `Dub Speaker ${seg.speaker} - ${origIdx}`,
				duration,
				startTime: seg.start,
			});
		});

		(dubTrack as any).elements = elements;

		const tracksAfter = [...tracksBefore, dubTrack];
		editor.timeline.updateTracks(tracksAfter);
		editor.timeline.pushTracksSnapshot({ before: tracksBefore, after: tracksAfter });

		// 4. Mute original video track if desired
		const videoTrack = tracksAfter.find(t => t.type === "video");
		if (videoTrack) {
			editor.timeline.toggleTrackMute({ trackId: videoTrack.id });
			toast.info("Original video audio muted to favor dubbed voice.");
		}

		setState({ stage: "done", progress: 100 });
		toast.success(`Successfully applied ${assetsToUpload.length} AI voice segments!`);
	}, [editor, setState]);

	const mergeAndDownload = useCallback(async () => {
		const currentState = editor.dub.getState();
		if (!currentState.targetTranscript || currentState.targetTranscript.length === 0) return;

		try {
			setState({ stage: "merging", progress: 0 });
			const ffmpeg = await getFFmpeg();
			const dubbedSegments = currentState.targetTranscript.filter(s => s.dubbedAudioKey);
			
			if (dubbedSegments.length === 0) return;

			// Write all segments to FFmpeg
			for (let i = 0; i < dubbedSegments.length; i++) {
				const seg = dubbedSegments[i];
				const blob = await getAudioBlob(seg.dubbedAudioKey!);
				if (blob) {
					await ffmpeg.writeFile(`seg_${i}.mp3`, await fetchFile(blob));
				}
			}

			// Build complex filter for amix with delays
			// Example: [0:a]adelay=1000|1000[a0]; [1:a]adelay=5000|5000[a1]; [a0][a1]amix=inputs=2
			let filter = "";
			for (let i = 0; i < dubbedSegments.length; i++) {
				const delayMs = Math.round(dubbedSegments[i].start * 1000);
				filter += `[${i}:a]adelay=${delayMs}|${delayMs}[a${i}];`;
			}
			for (let i = 0; i < dubbedSegments.length; i++) {
				filter += `[a${i}]`;
			}
			filter += `amix=inputs=${dubbedSegments.length}:normalize=0[out]`;

			const inputs: string[] = [];
			for (let i = 0; i < dubbedSegments.length; i++) {
				inputs.push("-i", `seg_${i}.mp3`);
			}

			await ffmpeg.exec([
				...inputs,
				"-filter_complex", filter,
				"-map", "[out]",
				"-ac", "2",
				"full_dub.mp3"
			]);

			const data = await ffmpeg.readFile("full_dub.mp3") as Uint8Array;
			const blob = new Blob([data.buffer as any], { type: "audio/mp3" });
			const url = URL.createObjectURL(blob);
			
			const a = document.createElement("a");
			a.href = url;
			a.download = `dubbed_audio_${assetId || "project"}.mp3`;
			a.click();
			URL.revokeObjectURL(url);
			
			toast.success("Full dubbed audio downloaded!");
			setState({ stage: "done", progress: 100 });
		} catch (err) {
			console.error("Merging for download failed:", err);
			toast.error("Failed to merge audio for download.");
			setState({ stage: "done", progress: 100 });
		}
	}, [editor, setState, assetId]);

	const updateSpeakerVoice = useCallback((speakerId: string, provider: "elevenlabs" | "sarvam", voiceId: string) => {
		const currentState = editor.dub.getState();
		
		// 1. Update speaker data
		const updatedSpeakers = currentState.speakers.map(s => 
			s.id === speakerId ? { ...s, voiceProvider: provider, voiceId } : s
		);

		// 2. Clear dubbed keys for this speaker in transcript
		const updatedTranscript = currentState.targetTranscript?.map(s => 
			s.speaker === speakerId ? { ...s, dubbedAudioKey: undefined } : s
		);

		setState({ 
			speakers: updatedSpeakers, 
			targetTranscript: updatedTranscript,
			stage: "done" // Reset stage to done so user can click "Generate" again
		});
	}, [editor, setState]);

	return {
		state,
		startDub,
		translateTranscript,
		generateDub,
		applyToTimeline,
		mergeAndDownload,
		updateSpeakerVoice,
		reset,
	};
}
