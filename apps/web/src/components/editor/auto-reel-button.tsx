"use client";

import { Button } from "../ui/button";
import { useEditor } from "@/hooks/use-editor";
import { invokeAction } from "@/lib/actions";
import { useEffect, useState } from "react";
import { MagicWand01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

export function AutoReelButton() {
	const editor = useEditor();
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const unsubscribe = editor.autoReel.subscribe(() => {
			setIsProcessing(editor.autoReel.getIsProcessing());
			setProgress(editor.autoReel.getProgress());
		});
		return unsubscribe;
	}, [editor]);

	const handleClick = () => {
		invokeAction("auto-reel");
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleClick}
			disabled={isProcessing}
			className={cn(
				"relative overflow-hidden transition-all duration-300",
				isProcessing && "w-32",
			)}
		>
			<div className="flex items-center gap-2 relative z-10">
				<HugeiconsIcon
					icon={MagicWand01Icon}
					className={cn("size-4", isProcessing && "animate-pulse")}
				/>
				<span>{isProcessing ? `${progress}%` : "Auto Reel"}</span>
			</div>
			{isProcessing && (
				<div
					className="absolute inset-0 bg-primary/10 transition-all duration-300"
					style={{ width: `${progress}%` }}
				/>
			)}
		</Button>
	);
}
