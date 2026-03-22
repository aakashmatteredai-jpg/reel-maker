"use client";

import { useState } from "react";
import { Mic01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { useDub } from "@/hooks/use-dub";
import { DubPanel } from "@/components/dub/dub-panel";
import { 
	Sheet, 
	SheetContent, 
	SheetHeader, 
	SheetTitle,
	SheetDescription
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function DubbingButton() {
	const [isOpen, setIsOpen] = useState(false);
	const { state, startDub } = useDub();
	const editor = useEditor();
	
	const hasProject = !!editor.project.getActiveOrNull();

	const handleDubClick = async () => {
		const tracks = editor.timeline.getTracks();
		const videoTrack = tracks.find(t => t.type === "video");
		const mainElement = videoTrack?.elements[0];
		
		if (!mainElement || !("mediaId" in mainElement)) {
			toast.error("No video element found to dub.");
			return;
		}

		const asset = editor.media.getAssets().find(a => a.id === mainElement.mediaId);
		if (!asset || !asset.file) {
			toast.error("Could not find video file.");
			return;
		}

		setIsOpen(true);
		if (state.stage === "idle") {
			await startDub(asset.file);
		}
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				className="gap-2 h-9 px-3 border-dashed hover:border-solid border-primary/50 hover:border-primary transition-all relative"
				onClick={handleDubClick}
				disabled={!hasProject || state.stage !== "idle" && state.stage !== "done" && state.stage !== "error"}
			>
				{state.stage !== "idle" && state.stage !== "done" && state.stage !== "error" ? (
					<Loader2 className="size-4 text-primary animate-spin" />
				) : (
					<HugeiconsIcon icon={Mic01Icon} className="size-4 text-primary" />
				)}
				<span className="text-xs font-medium">Dubbing & VO</span>
				
				{state.stage !== "idle" && (
					<Badge 
						variant="secondary" 
						className="absolute -top-2 -right-2 h-4 px-1 text-[10px] bg-primary text-primary-foreground"
					>
						{state.stage === "done" ? "✓" : "..."}
					</Badge>
				)}
			</Button>

			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetContent className="p-0 sm:max-w-[400px]">
					<DubPanel />
				</SheetContent>
			</Sheet>
		</>
	);
}
