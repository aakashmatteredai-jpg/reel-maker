"use client";

import { useState } from "react";
import { Mic01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { DubbingModal } from "./dubbing-modal";

export function DubbingButton() {
	const [isOpen, setIsOpen] = useState(false);
	const editor = useEditor();
	const hasProject = !!editor.project.getActiveOrNull();

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				className="gap-2 h-9 px-3 border-dashed hover:border-solid border-primary/50 hover:border-primary transition-all"
				onClick={() => setIsOpen(true)}
				disabled={!hasProject}
			>
				<HugeiconsIcon icon={Mic01Icon} className="size-4 text-primary" />
				<span className="text-xs font-medium">Dubming & VO</span>
			</Button>

			<DubbingModal isOpen={isOpen} onOpenChange={setIsOpen} />
		</>
	);
}
