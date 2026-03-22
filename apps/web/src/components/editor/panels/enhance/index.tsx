import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HooksPanel } from "./hooks-panel";
import { CaptionControls } from "./caption-controls";
import { VoiceoverPanel } from "./voiceover-panel";
import { SparklesIcon, BaselineIcon, MicIcon } from "lucide-react";

export function EnhancePanel() {
	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			<Tabs defaultValue="hooks" className="flex flex-col h-full">
				<div className="px-4 pt-3 pb-2 flex items-center justify-between border-b shrink-0">
					<h2 className="text-sm font-semibold flex items-center gap-2">
						<SparklesIcon className="h-4 w-4 text-amber-500" />
						AI Enhance
					</h2>
				</div>
				<TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-12 shrink-0">
					<TabsTrigger
						value="hooks"
						className="data-[state=active]:bg-muted/50 rounded-md text-xs"
					>
						Hooks
					</TabsTrigger>
					<TabsTrigger
						value="captions"
						className="data-[state=active]:bg-muted/50 rounded-md text-xs"
					>
						Captions
					</TabsTrigger>
					<TabsTrigger
						value="voiceover"
						className="data-[state=active]:bg-muted/50 rounded-md text-xs"
					>
						Voiceover
					</TabsTrigger>
				</TabsList>

				<div className="flex-1 overflow-y-auto">
					<TabsContent value="hooks" className="m-0 h-full">
						<HooksPanel />
					</TabsContent>
					<TabsContent value="captions" className="m-0 h-full">
						<CaptionControls />
					</TabsContent>
					<TabsContent value="voiceover" className="m-0 h-full">
						<VoiceoverPanel />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
