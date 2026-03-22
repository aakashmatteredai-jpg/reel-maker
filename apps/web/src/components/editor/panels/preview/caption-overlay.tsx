import { useMemo, useState, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useCaptionStore } from "@/stores/caption-store";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { injectEmojis } from "@/lib/transcription/emoji-map";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import type { TranscriptElement } from "@/types/timeline";

export function CaptionOverlay() {
	const editor = useEditor();
	const { enabled, style, useEmojis } = useCaptionStore();
	const { transcript } = useTranscriptionStore();
	const activeScene = editor.scenes.getActiveScene();
	const transcriptElement = useMemo<TranscriptElement | "hidden" | null>(() => {
		if (!activeScene) return null;
		for (const track of activeScene.tracks) {
			if (track.type === "transcript") {
				if (track.hidden) return "hidden";
				const element = track.elements[0] as TranscriptElement | undefined;
				if (element?.hidden) return "hidden";
				return element ?? null;
			}
		}
		return null;
	}, [activeScene]);

	const [currentTime, setCurrentTime] = useState(0);

	useEffect(() => {
		const unsubscribe = editor.playback.subscribe(() => {
			setCurrentTime(editor.playback.getCurrentTime());
		});
		return unsubscribe;
	}, [editor.playback]);

	const chunks = useMemo(() => {
		if (!transcript) return [];
		return buildCaptionChunks({ segments: transcript.segments });
	}, [transcript]);

	if (!enabled || !transcript || !transcriptElement || transcriptElement === "hidden") return null;

	const activeChunk = chunks.find(
		(chunk) =>
			currentTime >= chunk.startTime &&
			currentTime <= chunk.startTime + chunk.duration
	);

	if (!activeChunk) return null;

	const textToDisplay = useEmojis
		? injectEmojis(activeChunk.text)
		: activeChunk.text;

	return (
		<div
			className="pointer-events-none absolute left-0 right-0 flex justify-center text-center p-4 transition-all"
			style={{
				top: `${transcriptElement.positionY}%`,
				fontFamily: transcriptElement.fontFamily,
				fontSize: `${transcriptElement.fontSize}px`,
				color: transcriptElement.color,
				backgroundColor: transcriptElement.backgroundColor,
				lineHeight: 1.2,
				textShadow: transcriptElement.backgroundColor === "transparent" ? "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" : "none",
				fontWeight: "bold",
				transform: "translateY(-50%)",
				wordBreak: "break-word",
			}}
		>
			<span dangerouslySetInnerHTML={{ __html: textToDisplay.replace(/\\n/g, '<br />') }} />
		</div>
	);
}
