import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { generateHooks, type HookGenerationResult } from "@/lib/ai/hook-generator";
import { hasAnyAIKey } from "@/lib/ai/ai-config";
import { toast } from "sonner";
import { CopyIcon, SparklesIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";

export function HooksPanel() {
	const { transcript } = useTranscriptionStore();
	const [isGenerating, setIsGenerating] = useState(false);
	const [result, setResult] = useState<HookGenerationResult | null>(null);

	const handleGenerate = async () => {
		if (!transcript?.text) {
			toast.error("No transcript available", {
				description: "Please transcribe the video first to generate hooks.",
			});
			return;
		}

		if (!hasAnyAIKey()) {
			toast.error("AI Key Missing", {
				description: "Please configure an AI API key in Settings.",
			});
			return;
		}

		setIsGenerating(true);
		try {
			const data = await generateHooks(transcript.text);
			setResult(data);
			toast.success("Hooks generated successfully!");
		} catch (error) {
			toast.error("Generation failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copied to clipboard");
		} catch (err) {
			toast.error("Failed to copy");
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
			<div className="flex flex-col gap-2">
				<h3 className="text-sm font-medium">AI Hook Generator</h3>
				<p className="text-xs text-muted-foreground">
					Generate viral hooks, captions, and hashtags based on your video's transcript.
				</p>
			</div>

			<Button
				onClick={handleGenerate}
				disabled={isGenerating || !transcript}
				className="w-full"
			>
				{isGenerating ? (
					<>
						<RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
						Generating...
					</>
				) : (
					<>
						<SparklesIcon className="mr-2 h-4 w-4 text-amber-500" />
						{result ? "Regenerate Hooks" : "Generate Hooks"}
					</>
				)}
			</Button>

			{!transcript && (
				<div className="flex items-center gap-2 p-3 text-xs text-amber-600 bg-amber-500/10 rounded-md">
					<AlertCircleIcon className="h-4 w-4" />
					<p>Transcribe video first in the Transcribe tab to use this feature.</p>
				</div>
			)}

			{result && (
				<div className="flex flex-col gap-6 mt-4 pb-12">
					<div className="flex flex-col gap-2">
						<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Top 3 Hooks
						</h4>
						<div className="flex flex-col gap-2">
							{result.hooks.map((hook, idx) => (
								<Card key={idx} className="bg-muted/50">
									<CardContent className="p-3 flex items-center justify-between gap-2">
										<p className="text-sm font-medium leading-snug">{hook}</p>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 shrink-0"
											onClick={() => copyToClipboard(hook)}
										>
											<CopyIcon className="h-4 w-4" />
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Caption
						</h4>
						<Card className="bg-muted/50">
							<CardContent className="p-3 relative group">
								<p className="text-sm leading-relaxed whitespace-pre-wrap">{result.caption}</p>
								<Button
									variant="default"
									size="sm"
									className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
									onClick={() => copyToClipboard(result.caption)}
								>
									<CopyIcon className="mr-2 h-4 w-4" />
									Copy
								</Button>
							</CardContent>
						</Card>
					</div>

					<div className="flex flex-col gap-2">
						<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Hashtags
						</h4>
						<Card className="bg-muted/50">
							<CardContent className="p-3 flex items-center justify-between gap-2">
								<p className="text-sm text-blue-500 font-medium">
									{result.hashtags.join(" ")}
								</p>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									onClick={() => copyToClipboard(result.hashtags.join(" "))}
								>
									<CopyIcon className="h-4 w-4" />
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}
