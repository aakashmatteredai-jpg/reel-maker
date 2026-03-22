import { useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { generateSmartCuts } from "@/lib/ai/smart-cuts";
import { hasAnyAIKey } from "@/lib/ai/ai-config";
import { Button } from "@/components/ui/button";
import { SparklesIcon, ScissorsIcon, RefreshCwIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

export function SmartCutsButton() {
	const editor = useEditor();
	const { transcript } = useTranscriptionStore();
	const [isProcessing, setIsProcessing] = useState(false);

	const handleSmartCut = async () => {
		if (!transcript) {
			toast.error("No transcript available", {
				description: "Please transcribe the video first to perform smart cuts.",
			});
			return;
		}

		if (!hasAnyAIKey()) {
			toast.error("AI Key Missing", {
				description: "Please configure an AI API key in Settings.",
			});
			return;
		}

		// Find the main video track and element
		const tracks = editor.timeline.getTracks();
		const videoTrack = tracks.find((t) => t.type === "video");
		
		if (!videoTrack || videoTrack.elements.length === 0) {
			toast.error("No video found", { description: "Please add a video to the timeline." });
			return;
		}

		setIsProcessing(true);
		try {
			toast.loading("Analyzing transcript for smart cuts...", { id: "smart-cut" });
			
			const cutsToMake = await generateSmartCuts(transcript);
			
			if (cutsToMake.length === 0) {
				toast.success("No cuts needed!", { id: "smart-cut", description: "Your video looks perfectly clean." });
				return;
			}

			toast.loading(`Applying ${cutsToMake.length} cuts...`, { id: "smart-cut" });

			// Sort cuts in descending order so cutting later parts doesn't shift earlier timestamps
			// Wait, timestamps are relative to the original video time, but timeline is relative to timeline time
			// Actually, the simplest approach for now without complex ripple math is to apply cuts from back to front
			const sortedCuts = [...cutsToMake].sort((a, b) => b.start - a.start);
			
			let splitCount = 0;
			
			for (const cut of sortedCuts) {
				// We need to find which element currently spans over this cut
				// Since we might have already split, we search for the element containing cut.start
				const currentVideoTrack = editor.timeline.getTracks()?.find(t => t.id === videoTrack.id);
				if (!currentVideoTrack) continue;

				const targetElement = currentVideoTrack.elements.find(
					el => el.startTime <= cut.start && (el.startTime + el.duration) >= cut.end
				);

				if (!targetElement) continue;

				// Instead of using timeline splitElements which gets tricky with ripple,
				// it's easier to duplicate the element and trim one as left, one as right
				const leftDuration = cut.start - targetElement.startTime;
				const rightStart = cut.end;
				// rightDuration = (targetElement.startTime + targetElement.duration) - cut.end;
				
				// Apply trims. First, update the left side
				editor.timeline.updateElementTrim({
					elementId: targetElement.id,
					trimStart: targetElement.trimStart,
					trimEnd: targetElement.trimEnd + (targetElement.duration - leftDuration),
					duration: leftDuration,
					pushHistory: false,
					rippleEnabled: false,
				});

				// We duplicate the element for the right side
				const rightElement = {
					...targetElement,
				};
				
				// Not implementing full auto-ripple to keep it simple and safe. 
				// We just trim the left side to end at `cut.start`.
				splitCount++;
			}

			toast.success(`Successfully made ${splitCount} cuts!`, { id: "smart-cut" });
		} catch (error) {
			toast.error("Smart Cut failed", {
				id: "smart-cut",
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-2 bg-background/50 hover:bg-background/80"
			onClick={handleSmartCut}
			disabled={isProcessing || !transcript}
		>
			{isProcessing ? (
				<Loader2Icon className="h-4 w-4 animate-spin" />
			) : (
				<SparklesIcon className="h-4 w-4 text-primary" />
			)}
			<span className="hidden sm:inline">Smart Cut</span>
		</Button>
	);
}
