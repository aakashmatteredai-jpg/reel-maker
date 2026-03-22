"use client";

import { useState } from "react";
import { Mic01Icon, UserGroupIcon, RecordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { useDub } from "@/hooks/use-dub";
import { DubPanel } from "@/components/dub/dub-panel";
import { 
	Dialog, 
	DialogContent, 
	DialogHeader,
	DialogTitle,
	DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/ui";

export function DubbingButton() {
	const editor = useEditor();
	const [isOpen, setIsOpen] = useState(false);
	const [showChoice, setShowChoice] = useState(true);

	// Get the first video element on the timeline to use as a persistent key
	const tracks = editor.timeline.getTracks();
	const videoTrack = tracks.find(t => t.type === "video");
	const mainElement = videoTrack?.elements[0];
	const assetId = (mainElement && "mediaId" in mainElement) ? mainElement.mediaId : undefined;

	const { state, startDub } = useDub(assetId);
	
	const hasProject = !!editor.project.getActiveOrNull();

	const handleOpenClick = () => {
		setIsOpen(true);
		// If already processing or done, don't show choice
		if (state.stage !== "idle") {
			setShowChoice(false);
		} else {
			setShowChoice(true);
		}
	};

	const handleStartDub = async () => {
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

		setShowChoice(false);
		await startDub(asset.file);
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				className="gap-2 h-9 px-3 border-dashed hover:border-solid border-primary/50 hover:border-primary transition-all relative"
				onClick={handleOpenClick}
				disabled={!hasProject}
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

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="p-0 sm:max-w-[1000px] h-[90vh] flex flex-col overflow-hidden bg-background">
					<div className="sr-only">
						<DialogHeader>
							<DialogTitle>Dubbing & Voice Over</DialogTitle>
							<DialogDescription>Configure AI dubbing or add manual voice over to your video.</DialogDescription>
						</DialogHeader>
					</div>
					{showChoice && state.stage === "idle" ? (
						<div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 animate-in fade-in zoom-in duration-300">
							<div className="text-center space-y-2">
								<h3 className="text-xl font-bold italic tracking-tight">Dubbing & Voice Over</h3>
								<p className="text-sm text-muted-foreground">Select how you want to enhance your video audio</p>
							</div>

							<div className="grid grid-cols-1 gap-4 w-full">
								<button 
									onClick={handleStartDub}
									className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-center bg-card shadow-sm hover:shadow-md"
								>
									<div className="size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-primary/20">
										<HugeiconsIcon icon={UserGroupIcon} className="size-8 text-primary" />
									</div>
									<div className="space-y-1">
										<h4 className="font-bold text-lg">AI Dubbing</h4>
										<p className="text-xs text-muted-foreground leading-relaxed px-4">
											Automatically detect speakers, transcribe dialogue, and slice audio segments for dubbing.
										</p>
									</div>
								</button>

								<button 
									className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-border hover:border-secondary hover:bg-secondary/5 transition-all text-center bg-card shadow-sm hover:shadow-md"
									onClick={() => toast.info("Manual Voice Over is coming soon!")}
								>
									<div className="size-16 rounded-full bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-secondary/20">
										<HugeiconsIcon icon={RecordIcon} className="size-8 text-secondary" />
									</div>
									<div className="space-y-1">
										<h4 className="font-bold text-lg">Add Voice Over</h4>
										<p className="text-xs text-muted-foreground leading-relaxed px-4">
											Type or record your own narration and place it manually on the timeline.
										</p>
									</div>
								</button>
							</div>
						</div>
					) : (
						<DubPanel />
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
