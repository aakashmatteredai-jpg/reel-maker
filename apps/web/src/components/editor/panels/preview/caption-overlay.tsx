import { useMemo, useState, useEffect } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useCaptionStore } from "@/stores/caption-store";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { injectEmojis } from "@/lib/transcription/emoji-map";
import { buildCaptionChunks } from "@/lib/transcription/caption";

export function CaptionOverlay() {
	const editor = useEditor();
	const { enabled, style, useEmojis } = useCaptionStore();
	const { transcript } = useTranscriptionStore();
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

	if (!enabled || !transcript) return null;

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
				top: `${style.positionY}%`,
				fontFamily: style.fontFamily,
				fontSize: `${style.fontSize}px`,
				color: style.color,
				backgroundColor: style.backgroundColor,
				lineHeight: 1.2,
				textShadow: style.backgroundColor === "transparent" ? "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" : "none",
				fontWeight: "bold",
				transform: "translateY(-50%)",
				wordBreak: "break-word",
			}}
		>
			<span dangerouslySetInnerHTML={{ __html: textToDisplay.replace(/\\n/g, '<br />') }} />
		</div>
	);
}
