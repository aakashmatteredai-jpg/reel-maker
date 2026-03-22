import type { DubbingSegment, DubbingSpeaker } from "@/types/transcription";
import { getFFmpeg } from "@/lib/media/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const SPEAKER_COLORS = [
	"#ef4444", "#3b82f6", "#10b981", "#f59e0b",
	"#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

/**
 * Step 1: Extract Audio from Video
 * Using ffmpeg.wasm to get a 16kHz mono WAV file.
 */
export async function extractAudioFromVideo(videoFile: File | Blob): Promise<Blob> {
	const ffmpeg = await getFFmpeg();
	const inputName = "input_video.mp4";
	const outName = "extracted_audio.wav";

	await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

	await ffmpeg.exec([
		"-i", inputName,
		"-vn",
		"-acodec", "pcm_s16le",
		"-ar", "16000",
		"-ac", "1",
		outName,
	]);

	const data = await ffmpeg.readFile(outName) as Uint8Array;
	
	// Cleanup
	await ffmpeg.deleteFile(inputName);
	await ffmpeg.deleteFile(outName);

	return new Blob([data.buffer as ArrayBuffer], { type: "audio/wav" });
}

/**
 * Step 4: Extract a small audio chunk for embedding generation.
 */
async function extractEmbeddingChunk(
	audioSource: File | Blob,
	start: number,
	end: number
): Promise<Blob> {
	const ffmpeg = await getFFmpeg();
	const inputName = "source_for_embed.wav";
	const outName = "embed_chunk.wav";

	await ffmpeg.writeFile(inputName, await fetchFile(audioSource));

	// Take up to 2 seconds from the middle of the segment
	const duration = end - start;
	const extractDuration = Math.min(2, duration);
	const extractStart = start + (duration - extractDuration) / 2;

	await ffmpeg.exec([
		"-i", inputName,
		"-ss", String(extractStart),
		"-t", String(extractDuration),
		"-acodec", "copy",
		outName,
	]);

	const data = await ffmpeg.readFile(outName) as Uint8Array;
	
	// Cleanup
	await ffmpeg.deleteFile(inputName);
	await ffmpeg.deleteFile(outName);

	return new Blob([data.buffer as ArrayBuffer], { type: "audio/wav" });
}

/**
 * Step 3 & 4: Speaker Clustering
 * Clusters segments based on voice embeddings similarity.
 */
export async function clusterSpeakers(
	audioSource: File | Blob,
	segments: DubbingSegment[]
): Promise<Record<string, DubbingSegment[]>> {
	const { generateVoiceEmbedding, cosineSimilarity } = await import("@/lib/ai/embeddings");
	const clusters: { embedding: number[]; segments: DubbingSegment[] }[] = [];

	for (const seg of segments) {
		try {
			// Extract small chunk for embedding
			const chunk = await extractEmbeddingChunk(audioSource, seg.start, seg.end);
			const embedding = await generateVoiceEmbedding(chunk);

			// Compare with existing clusters
			let bestClusterIdx = -1;
			let maxSimilarity = 0;

			for (let i = 0; i < clusters.length; i++) {
				const sim = cosineSimilarity(embedding, clusters[i].embedding);
				if (sim > maxSimilarity) {
					maxSimilarity = sim;
					bestClusterIdx = i;
				}
			}

			if (maxSimilarity > 0.75 && bestClusterIdx !== -1) {
				clusters[bestClusterIdx].segments.push(seg);
				// Optionally update cluster embedding (moving average)
				for (let j = 0; j < embedding.length; j++) {
					clusters[bestClusterIdx].embedding[j] = (clusters[bestClusterIdx].embedding[j] + embedding[j]) / 2;
				}
			} else {
				clusters.push({ embedding, segments: [seg] });
			}
		} catch (err) {
			console.warn("Embedding generation failed for segment:", seg, err);
			// Fallback to temp speakerId if embedding fails
			const fallbackId = seg.speakerId || "unknown";
			const existingCluster = clusters.find(c => c.segments[0]?.speakerId === fallbackId);
			if (existingCluster) existingCluster.segments.push(seg);
			else clusters.push({ embedding: [], segments: [seg] });
		}
	}

	const result: Record<string, DubbingSegment[]> = {};
	clusters.forEach((c, i) => {
		result[`Speaker_${i + 1}`] = c.segments.sort((a, b) => a.start - b.start);
	});
	return result;
}

/**
 * Step 9: Min Segment Merge
 * If segment < 1s, merge with previous segment.
 */
export function mergeSmallSegments(segments: DubbingSegment[], minDuration = 1.0): DubbingSegment[] {
	if (segments.length === 0) return [];
	
	const sorted = [...segments].sort((a, b) => a.start - b.start);
	const merged: DubbingSegment[] = [];
	let current = { ...sorted[0] };

	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i];
		const duration = next.end - next.start;
		
		if (duration < minDuration) {
			// Merge with previous
			current.end = next.end;
			if (next.text) current.text += " " + next.text;
		} else {
			merged.push(current);
			current = { ...next };
		}
	}
	merged.push(current);
	return merged;
}

/**
 * Step 7: Map full transcript text to diarized segments.
 */
export function mapTranscriptToSegments(
	fullText: string,
	fullSegments: DubbingSegment[], // These contain text from STT
	diarizationSegments: DubbingSegment[] // These contain timing only
): DubbingSegment[] {
	return diarizationSegments.map((dSeg) => {
		// Find STT segments that overlap with this diarization segment
		const overlapping = fullSegments.filter(sSeg => {
			const overlapStart = Math.max(dSeg.start, sSeg.start);
			const overlapEnd = Math.min(dSeg.end, sSeg.end);
			return overlapStart < overlapEnd;
		});

		return {
			...dSeg,
			text: overlapping.map(s => s.text).join(" ").trim(),
			isDubbed: false,
		};
	});
}

/**
 * Produces ONE unified audio file for the speaker by merging their segments.
 */
export async function extractSpeakerAudio(
	audioSource: File | Blob,
	segments: DubbingSegment[]
): Promise<string> {
	const ffmpeg = await getFFmpeg();
	const inputName = "source_audio_for_merged.wav";
	await ffmpeg.writeFile(inputName, await fetchFile(audioSource));

	const chunkNames: string[] = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const outName = `speaker_merge_chunk_${i}.wav`;
		chunkNames.push(outName);
		
		const duration = seg.end - seg.start;

		await ffmpeg.exec([
			"-i", inputName,
			"-ss", String(seg.start),
			"-t", String(duration),
			"-acodec", "copy",
			outName,
		]);
	}

	// Concat
	const listContent = chunkNames.map((n) => `file '${n}'`).join("\n");
	await ffmpeg.writeFile("concat_list_merge.txt", new TextEncoder().encode(listContent));

	const mergedName = "merged_speaker_final.wav";
	await ffmpeg.exec([
		"-f", "concat",
		"-safe", "0",
		"-i", "concat_list_merge.txt",
		"-acodec", "copy",
		mergedName,
	]);

	const mergedData = (await ffmpeg.readFile(mergedName)) as Uint8Array;
	
	// Cleanup
	await ffmpeg.deleteFile(inputName);
	await ffmpeg.deleteFile("concat_list_merge.txt");
	await ffmpeg.deleteFile(mergedName);
	for (const name of chunkNames) await ffmpeg.deleteFile(name).catch(() => {});

	return URL.createObjectURL(new Blob([mergedData.buffer as ArrayBuffer], { type: "audio/wav" }));
}

/**
 * Step 6: Build Final Speaker Objects
 * Orchestrates the full pipeline.
 */
export async function executeDubbingPipeline(
	videoFile: File | Blob,
	onProgress?: (progress: string) => void
): Promise<{ speakers: DubbingSpeaker[]; segments: DubbingSegment[] }> {
	const { diarizeAudio, transcribeAudioSarvam } = await import("@/lib/ai/transcription");
	
	// Step 1: Extract Audio
	onProgress?.("Extracting audio from video...");
	const fullAudioBlob = await extractAudioFromVideo(videoFile);

	// Step 2-4: Diarization & Clustering
	onProgress?.("Detecting speakers using voice embeddings...");
	const diarization = await diarizeAudio(fullAudioBlob);
	const rawSegments = diarization.segments as DubbingSegment[];

	// Clustering logic
	const clusteredGroups = await clusterSpeakers(fullAudioBlob, rawSegments);
	const speakerIds = Object.keys(clusteredGroups);

	// Step 6: Full Transcription
	onProgress?.("Transcribing full audio...");
	const inputDuration = rawSegments.length > 0 ? rawSegments[rawSegments.length - 1].end : 0;
	const fullTranscript = await transcribeAudioSarvam(fullAudioBlob, inputDuration);

	const speakers: DubbingSpeaker[] = [];
	const allMappedSegments: DubbingSegment[] = [];

	// Step 7: Map transcript to grouped segments
	onProgress?.("Rebuilding speaker profiles...");
	for (let i = 0; i < speakerIds.length; i++) {
		const id = speakerIds[i];
		let segments = clusteredGroups[id];

		// Step 9: Min segment merge
		segments = mergeSmallSegments(segments);

		// Map full transcript segments back to these speaker segments
		const mappedSegments = mapTranscriptToSegments(fullTranscript.text, fullTranscript.segments as DubbingSegment[], segments);

		// Step 4: Extract per-speaker merged audio for preview
		const audioUrl = await extractSpeakerAudio(fullAudioBlob, mappedSegments);

		const speaker: DubbingSpeaker = {
			id: `speaker_${i + 1}`,
			name: `Speaker ${i + 1}`,
			color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
			audioUrl,
			segments: mappedSegments,
			fullText: mappedSegments.map(s => s.text).join(" "),
			totalDuration: segments.reduce((acc, s) => acc + (s.end - s.start), 0),
			confirmed: false,
		};

		// Assign actual speakerId back to mapped segments
		mappedSegments.forEach(s => s.speakerId = speaker.id);
		
		speakers.push(speaker);
		allMappedSegments.push(...mappedSegments);
	}

	// Step 10: Debug Logging
	console.log("Detected speakers:", speakers.length);
	console.table(speakers.map(s => ({
		id: s.id,
		segments: s.segments.length,
		duration: s.totalDuration.toFixed(2) + "s",
		textPreview: s.fullText.substring(0, 50) + "..."
	})));

	return { 
		speakers, 
		segments: allMappedSegments.sort((a, b) => a.start - b.start) 
	};
}
