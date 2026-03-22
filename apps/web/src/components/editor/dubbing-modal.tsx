"use client";

import { useState, useEffect } from "react";
import { 
	Mic01Icon, 
	UserGroupIcon, 
	RecordIcon, 
	PlayIcon,
	CheckmarkCircle01Icon,
	AlertCircleIcon,
	Download01Icon,
	Settings01Icon,
	UserIcon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import { useDubbingStore } from "@/stores/dubbing-store";
import { diarizeAudio } from "@/lib/ai/transcription";
import { useDubbing } from "@/hooks/use-dubbing";
import { getAvailableVoices, type Voice } from "@/lib/ai/voiceover";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import { Badge } from "@/components/ui/badge";

interface DubbingModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

type DubbingStep = "choice" | "diarizing" | "configuration" | "dubbing";

export function DubbingModal({ isOpen, onOpenChange }: DubbingModalProps) {
	const [step, setStep] = useState<DubbingStep>("choice");
	const [voices, setVoices] = useState<Voice[]>([]);
	const { 
		characters, 
		segments, 
		isDiarizing, 
		isDubbing,
		setCharacters,
		updateCharacter,
		setSegments,
		setIsDiarizing,
		setIsDubbing,
		resetDubbing
	} = useDubbingStore();
	const editor = useEditor();

	useEffect(() => {
		if (isOpen) {
			getAvailableVoices().then(setVoices);
		} else {
			// Don't reset everything on close unless we want to
		}
	}, [isOpen]);

	const handleStartDiarization = async () => {
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

		setStep("diarizing");
		setIsDiarizing(true);
		
		try {
			toast.loading("Analyzing speakers and transcription...", { id: "diarize" });
			const result = await diarizeAudio(asset.file);
			
			// Map segments to store
			setSegments(result.segments.map(s => ({ ...s, isDubbed: false })));
			
			// Extract unique speakers
			const uniqueSpeakerIds = Array.from(new Set(result.segments.map(s => s.speakerId).filter(Boolean))) as string[];
			
			const newCharacters = uniqueSpeakerIds.map(id => ({
				id,
				name: `Character ${id.split("_")[1] || id}`,
				gender: (result.segments.find(s => s.speakerId === id)?.gender as any) || "neutral",
				ttsProvider: "elevenlabs" as const,
			}));
			
			setCharacters(newCharacters);
			setStep("configuration");
			toast.success("Analysis complete!", { id: "diarize" });
		} catch (error) {
			console.error(error);
			toast.error("Analysis failed", { id: "diarize" });
			setStep("choice");
		} finally {
			setIsDiarizing(false);
		}
	};

	const { dubAll } = useDubbing();

	const handleDubAll = async () => {
		await dubAll();
		onOpenChange(false);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
				<DialogHeader className="p-6 pb-2">
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Mic01Icon} className="size-5 text-primary" />
						Dubbing & Voiceover
					</DialogTitle>
					<DialogDescription>
						Enhance your video with professional dubbing and voiceovers.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col">
					{step === "choice" && (
						<div className="flex flex-col items-center justify-center p-12 gap-8">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
								<button 
									onClick={handleStartDiarization}
									className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
								>
									<div className="size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
										<HugeiconsIcon icon={UserGroupIcon} className="size-8 text-primary" />
									</div>
									<div className="space-y-1">
										<h4 className="font-semibold">Dub Audio</h4>
										<p className="text-sm text-muted-foreground">Detect speakers, characters, and gender automatically. Assign professional voices.</p>
									</div>
								</button>

								<button 
									className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
									onClick={() => toast.info("Manual Voice Over is coming soon!")}
								>
									<div className="size-16 rounded-full bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
										<HugeiconsIcon icon={RecordIcon} className="size-8 text-secondary" />
									</div>
									<div className="space-y-1">
										<h4 className="font-semibold">Add Voice Over</h4>
										<p className="text-sm text-muted-foreground">Type or record your own narration and place it manually on the timeline.</p>
									</div>
								</button>
							</div>
						</div>
					)}

					{step === "diarizing" && (
						<div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
							<div className="relative size-24">
								<div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
								<div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
								<div className="absolute inset-0 flex items-center justify-center">
									<HugeiconsIcon icon={Mic01Icon} className="size-8 text-primary animate-pulse" />
								</div>
							</div>
							<h3 className="text-xl font-medium">Analyzing Video...</h3>
							<p className="text-muted-foreground text-center max-w-sm">
								We're detecting speakers, transcribing dialogue, and identifying voices. This may take a minute.
							</p>
						</div>
					)}

					{step === "configuration" && (
						<div className="flex-1 flex overflow-hidden border-t">
							{/* Sidebar - Character List */}
							<div className="w-64 border-r bg-muted/30 flex flex-col overflow-hidden">
								<div className="p-4 border-b bg-background">
									<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Characters</h4>
								</div>
								<ScrollArea className="flex-1">
									<div className="p-2 space-y-1">
										{characters.map((char) => (
											<button 
												key={char.id}
                                                // TODO: Selection state
												className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left group"
											>
												<div className={cn(
													"size-10 rounded-full flex items-center justify-center text-lg shrink-0",
													char.gender === "female" ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" : 
													char.gender === "male" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
													"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
												)}>
													<HugeiconsIcon icon={UserIcon} className="size-5" />
												</div>
												<div className="flex-1 min-w-0">
													<p className="font-medium truncate text-sm">{char.name}</p>
													<p className="text-[10px] text-muted-foreground flex items-center gap-1">
														<Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-background capitalize">
															{char.gender}
														</Badge>
														{segments.filter(s => s.speakerId === char.id).length} clips
													</p>
												</div>
											</button>
										))}
									</div>
								</ScrollArea>
							</div>

							{/* Main Content - Character Configuration */}
							<div className="flex-1 flex flex-col overflow-hidden bg-background">
								<ScrollArea className="flex-1">
									<div className="p-6 space-y-8">
										{/* Selection Context - for now just the first character or iterate all */}
										{characters.map((char) => (
											<div key={char.id} className="space-y-6 pb-8 border-b last:border-0">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-4">
														<div className={cn(
															"size-12 rounded-full flex items-center justify-center shrink-0",
															char.gender === "female" ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30" : 
															char.gender === "male" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
															"bg-slate-100 text-slate-600 dark:bg-slate-800"
														)}>
															<HugeiconsIcon icon={UserIcon} className="size-6" />
														</div>
														<div className="space-y-1">
															<Input 
																value={char.name}
																onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
																className="h-8 font-semibold text-lg bg-transparent border-transparent hover:border-input focus:bg-background px-1 -ml-1 transition-all"
															/>
															<div className="flex items-center gap-2">
																<div className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 pointer-events-none">
																	<span className="text-[10px] font-medium uppercase text-muted-foreground">ID: {char.id}</span>
																</div>
															</div>
														</div>
													</div>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
													<div className="space-y-3">
														<Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Gender</Label>
														<div className="flex gap-2">
															{(["male", "female", "neutral"] as const).map((g) => (
																<Button
																	key={g}
																	variant={char.gender === g ? "default" : "outline"}
																	size="sm"
																	className="flex-1 capitalize text-xs"
																	onClick={() => updateCharacter(char.id, { gender: g })}
																>
																	{g}
																</Button>
															))}
														</div>
													</div>

													<div className="space-y-3">
														<Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Voice Model</Label>
														<Select 
															value={char.ttsVoiceId}
															onValueChange={(v) => {
																const voice = voices.find(sv => sv.id === v);
																updateCharacter(char.id, { 
																	ttsVoiceId: v, 
																	ttsProvider: voice?.provider as any 
																});
															}}
														>
															<SelectTrigger className="h-9">
																<SelectValue placeholder="Select a voice..." />
															</SelectTrigger>
															<SelectContent>
																{voices.filter(v => 
																	char.gender === "neutral" || 
																	v.gender === "neutral" || 
																	v.gender === char.gender
																).map((v) => (
																	<SelectItem key={v.id} value={v.id}>
																		<div className="flex items-center gap-2">
																			<span className="font-medium">{v.name}</span>
																			<span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted border border-border capitalize">
																				{v.provider}
																			</span>
																		</div>
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												</div>

												<div className="space-y-3">
													<Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Dialogue Fragments</Label>
													<div className="space-y-2">
														{segments.filter(s => s.speakerId === char.id).map((seg, idx) => (
															<div key={idx} className="flex gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
																<div className="flex-1 space-y-1">
																	<div className="flex items-center justify-between">
																		<span className="text-[10px] font-mono text-muted-foreground">{seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s</span>
																		<Button 
																			variant="ghost" 
																			size="icon" 
																			className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
																			onClick={() => {
																				editor.playback.seek({ time: seg.start });
																				editor.playback.play();
																				// Pause after segment duration
																				setTimeout(() => {
																					editor.playback.pause();
																				}, (seg.end - seg.start) * 1000);
																			}}
																		>
																			<HugeiconsIcon icon={PlayIcon} className="size-3" />
																		</Button>
																	</div>
																	<p className="text-sm italic text-foreground/80 leading-relaxed line-clamp-2">"{seg.text}"</p>
																</div>
															</div>
														))}
													</div>
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
								
								<div className="p-4 border-t bg-muted/20 flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
										<span>All characters correctly identified.</span>
									</div>
									<div className="flex gap-2">
										<Button variant="outline" size="sm" onClick={() => setStep("choice")}>Back</Button>
										<Button size="sm" onClick={handleDubAll} disabled={isDubbing}>
											{isDubbing ? (
												<>
													<HugeiconsIcon icon={Settings01Icon} className="size-4 animate-spin mr-2" />
													Dubbing...
												</>
											) : (
												<>
													<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 mr-2" />
													Complete Dubbing
												</>
											)}
										</Button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
