import { useCaptionStore } from "@/stores/caption-store";
import { useTranscriptionStore } from "@/stores/transcription-store";
import { useEditor } from "@/hooks/use-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FONT_FAMILIES } from "@/constants/font-constants";
import { transcribeAudioSarvam } from "@/lib/ai/transcription";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCwIcon, MicIcon } from "lucide-react";

export function CaptionControls() {
	const editor = useEditor();
	const { enabled, style, useEmojis, setEnabled, setStyle, setUseEmojis } =
		useCaptionStore();
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
		<div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
			<Card className="shadow-none bg-muted/30">
				<CardHeader className="p-4 pb-2">
					<CardTitle className="text-sm flex items-center gap-2">
						<MicIcon className="w-4 h-4 text-blue-500" /> 
						Auto Transcribe
					</CardTitle>
				</CardHeader>
				<CardContent className="p-4 pt-1 flex flex-col gap-3">
					<p className="text-xs text-muted-foreground">
						{transcript 
							? "Video is transcribed! You can now use Smart Cuts and Hooks."
							: "Generate a transcript to use Captions, Smart Cuts, and Hooks."}
					</p>
					<Button 
						onClick={handleTranscribe} 
						disabled={isTranscribing}
						variant={transcript ? "outline" : "default"}
						className="w-full text-xs h-8"
					>
						{isTranscribing ? (
							<><RefreshCwIcon className="mr-2 h-3 w-3 animate-spin" /> Transcribing...</>
						) : (
							<><MicIcon className="mr-2 h-3 w-3" /> {transcript ? "Re-Transcribe" : "Transcribe Video"}</>
						)}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="p-4 pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Caption Overlay</CardTitle>
						<Switch checked={enabled} onCheckedChange={setEnabled} disabled={!transcript && !enabled} />
					</div>
				</CardHeader>
				{enabled && (
					<CardContent className="p-4 pt-0 flex flex-col gap-4">
						<div className="flex items-center justify-between mt-2">
							<Label className="text-sm">Use AI Emojis</Label>
							<Switch checked={useEmojis} onCheckedChange={setUseEmojis} />
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Font</Label>
							<Select
								value={style.fontFamily}
								onValueChange={(val) => setStyle({ fontFamily: val })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select font" />
								</SelectTrigger>
								<SelectContent>
									{FONT_FAMILIES.map((font) => (
										<SelectItem key={font.id} value={font.name}>
											<span style={{ fontFamily: font.name }}>{font.name}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-2 relative">
							<div className="flex justify-between">
								<Label className="text-xs text-muted-foreground">Size</Label>
								<span className="text-xs text-muted-foreground">{style.fontSize}px</span>
							</div>
							<Slider
								value={[style.fontSize]}
								min={16}
								max={72}
								step={1}
								onValueChange={([val]) => setStyle({ fontSize: val })}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Color</Label>
							<div className="flex gap-2">
								<Input
									type="color"
									value={style.color}
									onChange={(e) => setStyle({ color: e.target.value })}
									className="w-12 h-8 p-1"
								/>
								<Input
									type="text"
									value={style.color}
									onChange={(e) => setStyle({ color: e.target.value })}
									className="flex-1 h-8"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Background</Label>
							<div className="flex gap-2">
								<Input
									type="color"
									value={style.backgroundColor === "transparent" ? "#000000" : style.backgroundColor}
									onChange={(e) => setStyle({ backgroundColor: e.target.value })}
									className="w-12 h-8 p-1"
								/>
								<Select
									value={style.backgroundColor === "transparent" ? "transparent" : "solid"}
									onValueChange={(val) => {
										if (val === "transparent") setStyle({ backgroundColor: "transparent" });
										else setStyle({ backgroundColor: "#000000" });
									}}
								>
									<SelectTrigger className="flex-1 h-8">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="transparent">Transparent</SelectItem>
										<SelectItem value="solid">Solid Color</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<div className="flex justify-between">
								<Label className="text-xs text-muted-foreground">Vertical Position</Label>
								<span className="text-xs text-muted-foreground">{style.positionY}%</span>
							</div>
							<Slider
								value={[style.positionY]}
								min={10}
								max={90}
								step={1}
								onValueChange={([val]) => setStyle({ positionY: val })}
							/>
						</div>
					</CardContent>
				)}
			</Card>
		</div>
	);
}
