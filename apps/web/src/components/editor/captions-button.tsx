import { Button } from "../ui/button";
import { useCaptionStore } from "@/stores/caption-store";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";
import { useTranscriptionStore } from "@/stores/transcription-store";

export function CaptionsButton() {
	const { enabled, setEnabled } = useCaptionStore();
	const { transcript } = useTranscriptionStore();
	
	if (!transcript) return null;

	return (
		<Button
			variant="ghost"
			size="sm"
			className={cn(
				"gap-2 px-3",
				enabled ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground"
			)}
			onClick={() => setEnabled(!enabled)}
			title={enabled ? "Disable Captions" : "Enable Captions"}
		>
			<HugeiconsIcon icon={BubbleChatIcon} className="size-4" />
			<span className="hidden lg:inline">Captions</span>
		</Button>
	);
}
