import { useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { transcribeAudioSarvam } from "@/lib/ai/transcription";
import { Button } from "@/components/ui/button";
import { MicIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

export function TranscribeButton() {
	const editor = useEditor();
	const { transcript, setTranscript } = useTranscriptionStore();
	const [isTranscribing, setIsTranscribing] = useState(false);

	const handleTranscribe = async () => {
		const videoTrack = editor.timeline.getTracks().find((t) => t.type === "video");
		if (!videoTrack || videoTrack.elements.length === 0) {
			toast.error("No video found to transcribe.");
			return;
		}

		const element = videoTrack.elements[0];
		if (element.type !== "video") return;

		const asset = editor.media.getAssets().find((a) => a.id === element.mediaId);
		if (!asset || !asset.file) {
			toast.error("Video asset/file not found.");
			return;
		}

		setIsTranscribing(true);
		try {
			toast.loading("Transcribing video with Sarvam AI...", { id: "transcribe" });
			const result = await transcribeAudioSarvam(asset.file, asset.duration || 0);
			setTranscript(result);
			toast.success("Transcription complete!", { id: "transcribe" });
		} catch (error) {
			toast.error("Transcription failed", {
				id: "transcribe",
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsTranscribing(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-2 bg-background/50 hover:bg-background/80"
			onClick={handleTranscribe}
			disabled={isTranscribing}
		>
			{isTranscribing ? (
				<RefreshCwIcon className="h-4 w-4 animate-spin text-blue-500" />
			) : (
				<MicIcon className={`h-4 w-4 ${transcript ? "text-green-500" : "text-blue-500"}`} />
			)}
			<span className="hidden sm:inline">
				{transcript ? "Re-Transcribe" : "Transcribe"}
			</span>
		</Button>
	);
}
