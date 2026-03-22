import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, SparklesIcon, RefreshCwIcon, Volume2Icon, MicIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getAvailableVoices, generateSpeech, type Voice } from "@/lib/ai/voiceover";
import { getApiKey } from "@/lib/ai/ai-config";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { generateUUID } from "@/utils/id";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";

export function VoiceoverPanel() {
	const editor = useEditor();
	const [text, setText] = useState("");
	const [voices, setVoices] = useState<Voice[]>([]);
	const [isLoadingVoices, setIsLoadingVoices] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [filterLanguage, setFilterLanguage] = useState<string>("all");
	const [filterGender, setFilterGender] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");

	useEffect(() => {
		async function fetchVoices() {
			if (!getApiKey("elevenlabs") && !getApiKey("sarvam")) return;
			setIsLoadingVoices(true);
			try {
				const fetchedVoices = await getAvailableVoices();
				setVoices(fetchedVoices);
				if (fetchedVoices.length > 0) {
					setSelectedVoiceId(fetchedVoices[0].id);
				}
			} catch (e) {
				console.error(e);
			} finally {
				setIsLoadingVoices(false);
			}
		}
		fetchVoices();
	}, []);

	const filteredVoices = useMemo(() => {
		return voices.filter(v => {
			if (filterLanguage !== "all" && !v.language.toLowerCase().includes(filterLanguage.toLowerCase())) return false;
			if (filterGender !== "all" && v.gender !== filterGender) return false;
			if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
			return true;
		});
	}, [voices, filterLanguage, filterGender, searchQuery]);

	const selectedVoice = voices.find(v => v.id === selectedVoiceId);

	const handlePlayPreview = () => {
		if (selectedVoice?.previewUrl) {
			const audio = new Audio(selectedVoice.previewUrl);
			audio.play();
		} else {
			toast.info("No preview available for this voice.");
		}
	};

	const handleGenerate = async () => {
		if (!text.trim()) {
			toast.error("Please enter some text to generate voiceover.");
			return;
		}

		if (!selectedVoice) {
			toast.error("Please select a voice.");
			return;
		}

		setIsGenerating(true);
		
		try {
			toast.loading("Generating voiceover...", { id: "voiceover" });
			const audioBlob = await generateSpeech(selectedVoice.provider, text, selectedVoice.id);
			
			// Auto import into timeline
			const file = new File([audioBlob], `Voiceover - ${selectedVoice.name}.wav`, { type: "audio/wav" });
			const duration = 5; // Placeholder, would need to read metadata or calculate from buffer
			
			// Using standard HTML5 audio to get duration
			const url = URL.createObjectURL(file);
			const audioEl = new Audio(url);
			
			audioEl.onloadedmetadata = async () => {
				const durationS = audioEl.duration;
				
				const newAsset = {
					name: file.name,
					type: "audio" as const,
					size: file.size,
					duration: durationS,
					file: file,
					url,
				};

				const projectId = editor.project.getActive()?.metadata.id || "default";
				const mediaId = await editor.media.addMediaAsset({
					projectId,
					asset: newAsset
				});
				
				if (mediaId) {
					toast.success("Voiceover generated and added to assets!", { id: "voiceover" });
					
					// Optional: auto-add to timeline using a new audio track
					const trackId = editor.timeline.addTrack({ type: "audio" });
					const element = buildElementFromMedia({
						mediaId,
						mediaType: "audio",
						name: "Voiceover",
						duration: durationS,
						startTime: editor.playback.getCurrentTime(),
					});

					editor.timeline.insertElement({
						element,
						placement: { mode: "explicit", trackId }
					});
					toast.success("Added to timeline!", { id: "voiceover" });
				}
			};
		} catch (error) {
			console.error(error);
			toast.error("Voiceover generation failed", {
				id: "voiceover",
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const hasKeys = getApiKey("elevenlabs") || getApiKey("sarvam");

	if (!hasKeys) {
		return (
			<div className="flex flex-col gap-4 p-4 items-center justify-center text-center h-full">
				<MicIcon className="h-12 w-12 text-muted-foreground/30 mb-2" />
				<h3 className="text-lg font-medium">Configure AI Voiceover</h3>
				<p className="text-sm text-muted-foreground max-w-xs">
					Add your ElevenLabs or Sarvam API key in the AI Settings to use AI voiceovers.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4 h-full overflow-y-auto">
			<div className="flex flex-col gap-2">
				<h3 className="text-sm font-medium">Text to Speech</h3>
				<p className="text-xs text-muted-foreground mb-2">
					Generate lifelike voiceovers using ElevenLabs and Sarvam AI.
				</p>
				<Textarea
					placeholder="Enter text here..."
					className="min-h-[120px] resize-none"
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
			</div>

			<div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-xl border">
				<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Voice Browser
				</h4>

				<div className="flex gap-2">
					<Input 
						placeholder="Search voices..." 
						className="flex-1 h-8 text-xs"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<div className="flex gap-2">
					<Select value={filterLanguage} onValueChange={setFilterLanguage}>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue placeholder="Language" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Languages</SelectItem>
							<SelectItem value="en">English</SelectItem>
							<SelectItem value="hi">Hindi</SelectItem>
							<SelectItem value="ta">Tamil</SelectItem>
							<SelectItem value="te">Telugu</SelectItem>
						</SelectContent>
					</Select>

					<Select value={filterGender} onValueChange={setFilterGender}>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue placeholder="Gender" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Any Gender</SelectItem>
							<SelectItem value="male">Male</SelectItem>
							<SelectItem value="female">Female</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-xs">Selected Voice</Label>
					<div className="flex gap-2">
						<Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
							<SelectTrigger className="flex-1">
								<SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Select a voice"} />
							</SelectTrigger>
							<SelectContent className="max-h-64">
								{filteredVoices.map(v => (
									<SelectItem key={v.id} value={v.id}>
										{v.name} ({v.provider === 'elevenlabs' ? 'ElevenLabs' : 'Sarvam'})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						
						<Button variant="outline" size="icon" onClick={handlePlayPreview} title="Play Preview">
							<Volume2Icon className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<Button 
				className="w-full mt-2" 
				onClick={handleGenerate}
				disabled={isGenerating || !text.trim() || !selectedVoiceId}
			>
				{isGenerating ? (
					<>
						<RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
						Generating & Downloading...
					</>
				) : (
					<>
						<MicIcon className="mr-2 h-4 w-4" />
						Generate Voiceover
					</>
				)}
			</Button>
		</div>
	);
}
