import type { EditorCore } from "@/core";
import { detectSilence, getSpeakingSegments, mergeSpeakingSegments, splitIntoClips } from "@/lib/auto-reel/silence-detector";
import { generateUUID } from "@/utils/id";

export class AutoReelManager {
	private isProcessing = false;
	private progress = 0;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	async generate(): Promise<void> {
		if (this.isProcessing) return;

		const tracks = this.editor.timeline.getTracks();
		const videoTrack = tracks.find((t) => t.type === "video");
		if (!videoTrack || videoTrack.elements.length === 0) {
			throw new Error("No video found in timeline to process.");
		}

		// Use the first video element
		const element = videoTrack.elements[0];
		if (element.type !== "video") return;

		const asset = this.editor.media.getAssets().find((a) => a.id === element.mediaId);
		if (!asset) {
			throw new Error("Video asset not found.");
		}

		this.setProcessing(true);
		this.setProgress(10);

		try {
			// Fetch the file from the blob URL
			this.setProgress(20);
			if (!asset.url) throw new Error("Asset URL is missing.");
			const response = await fetch(asset.url);
			const blob = await response.blob();
			const file = new File([blob], asset.name, { type: blob.type });

			this.setProgress(30);
			const silenceSegments = await detectSilence(file);
			
			this.setProgress(60);
			const speakingSegments = getSpeakingSegments(silenceSegments, element.duration);
			const mergedSegments = mergeSpeakingSegments(speakingSegments, 1.0);
			const clips = splitIntoClips(mergedSegments, 5, 20); // 5-20s clips

			if (clips.length === 0) {
				throw new Error("No significant speaking parts found.");
			}

			this.setProgress(80);
			
			// Clear current tracks and add generated clips
			// We'll just create a new video track for the reel
			const newTrackId = this.editor.timeline.addTrack({ type: "video" });
			let currentTimelineTime = 0;

			for (const clip of clips) {
				const clipDuration = clip.end - clip.start;
				const elementId = generateUUID();

				this.editor.timeline.insertElement({
					element: {
						type: "video",
						name: `${asset.name} (Clip)`,
						mediaId: asset.id,
						startTime: currentTimelineTime,
						duration: clipDuration,
						trimStart: clip.start,
						trimEnd: (asset.duration || 0) - clip.end,
						transform: {
							scale: 1,
							position: { x: 0, y: 0 },
							rotate: 0,
						},
						opacity: 1,
					},
					placement: {
						mode: "explicit",
						trackId: newTrackId,
					}
				});

				// Auto Zoom Effect (Random scale between 1.0 and 1.2)
				const randomScale = 1.0 + Math.random() * 0.2;
				const randomX = (Math.random() - 0.5) * 50; // shift +/- 25px
				const randomY = (Math.random() - 0.5) * 50;

				this.editor.timeline.upsertKeyframes({
					keyframes: [
						{
							trackId: newTrackId,
							elementId,
							propertyPath: "transform.scale",
							time: 0,
							value: 1,
							interpolation: "linear",
						},
						{
							trackId: newTrackId,
							elementId,
							propertyPath: "transform.scale",
							time: clipDuration / 2,
							value: randomScale,
							interpolation: "linear",
						},
						{
							trackId: newTrackId,
							elementId,
							propertyPath: "transform.scale",
							time: clipDuration,
							value: 1,
							interpolation: "linear",
						},
						{
							trackId: newTrackId,
							elementId,
							propertyPath: "transform.position.x",
							time: clipDuration / 2,
							value: randomX,
							interpolation: "linear",
						},
						{
							trackId: newTrackId,
							elementId,
							propertyPath: "transform.position.y",
							time: clipDuration / 2,
							value: randomY,
							interpolation: "linear",
						}
					]
				});

				currentTimelineTime += clipDuration + 0.5; // Add a small gap between clips
			}

			this.setProgress(100);
			this.editor.playback.seek({ time: 0 });

		} catch (error) {
			console.error("Auto Reel failed:", error);
			throw error;
		} finally {
			this.setProcessing(false);
		}
	}

	private setProcessing(processing: boolean): void {
		this.isProcessing = processing;
		this.notify();
	}

	private setProgress(progress: number): void {
		this.progress = progress;
		this.notify();
	}

	getIsProcessing(): boolean {
		return this.isProcessing;
	}

	getProgress(): number {
		return this.progress;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
