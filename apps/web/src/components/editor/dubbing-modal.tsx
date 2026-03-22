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
import { SpeakerVerificationCard } from "@/components/editor/speaker-verification-card";

interface DubbingModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

type DubbingStep = "choice" | "diarizing" | "configuration" | "dubbing";

function mergeShortSegments(segments: any[], threshold = 0.5) {
	if (segments.length <= 1) return segments;
	const merged: any[] = [];
	let current = { ...segments[0] };

	for (let i = 1; i < segments.length; i++) {
		const next = segments[i];
		if (current.end - current.start < threshold) {
			current = {
				...next,
				start: current.start,
				text: current.text + " " + next.text
			};
		} else {
			merged.push(current);
			current = { ...next };
		}
	}
	merged.push(current);
	return merged;
}

export function DubbingModal({ isOpen, onOpenChange }: DubbingModalProps) {
	const [step, setStep] = useState<DubbingStep>("choice");
	const [activeTab, setActiveTab] = useState<"characters" | "sequence">("characters");
	const [voices, setVoices] = useState<Voice[]>([]);
	const { 
		characters, 
		segments,
		speakers,
		projects,
		activeProjectId,
		isDiarizing, 
		isDubbing,
		setCharacters,
		updateCharacter,
		setSpeakers,
		setSegments,
		setIsDiarizing,
		setIsDubbing,
		resetDubbing,
		loadAllProjects,
		createAndActivateProject,
		setActiveProject,
		removeProject,
		allSpeakersConfirmed,
		confirmSpeaker,
	} = useDubbingStore();
	const editor = useEditor();
	const currentTime = editor.playback.getCurrentTime();
	const activeSegment = segments.find(s => currentTime >= s.start && currentTime <= s.end);

	useEffect(() => {
		if (isOpen) {
			getAvailableVoices().then(setVoices);
			loadAllProjects();
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
			const mergedSegments = mergeShortSegments(result.segments);
			const dubbingSegments = mergedSegments.map((s: any) => ({ ...s, isDubbed: false }));

			toast.loading("Extracting per-speaker audio...", { id: "diarize" });
			const { buildSpeakerProfiles } = await import("@/lib/dubbing/speaker-processor");
			const builtSpeakers = await buildSpeakerProfiles(dubbingSegments, asset.file);

			// Create and save project automatically
			const projectName = `Dub ${new Date().toLocaleTimeString()}`;
			createAndActivateProject(projectName, builtSpeakers, dubbingSegments, asset.url);

			setStep("configuration");
			toast.success("Analysis complete! Project saved.", { id: "diarize" });
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

							{/* Saved Projects */}
							{projects.length > 0 && (
								<div className="w-full max-w-2xl space-y-3">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved Projects</h4>
										<span className="text-[10px] text-muted-foreground">{projects.length} project{projects.length > 1 ? "s" : ""}</span>
									</div>
									<div className="space-y-2">
										{projects.map((proj) => (
											<div key={proj.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
												<button
													className="flex-1 flex items-center gap-3 text-left"
													onClick={() => {
														setActiveProject(proj.id);
														setStep("configuration");
													}}
												>
													<div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
														<HugeiconsIcon icon={Mic01Icon} className="size-4 text-primary" />
													</div>
													<div className="min-w-0">
														<p className="text-sm font-medium truncate">{proj.name}</p>
														<p className="text-[10px] text-muted-foreground">
															{proj.speakers.length} speakers • {new Date(proj.createdAt).toLocaleString()}
														</p>
													</div>
												</button>
												<Button
													variant="ghost"
													size="icon"
													className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
													onClick={(e) => {
														e.stopPropagation();
														removeProject(proj.id);
													}}
												>
													<HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
												</Button>
											</div>
										))}
									</div>
								</div>
							)}
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
								<div className="p-4 border-b bg-background flex flex-col gap-3">
									<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Views</h4>
									<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
										<TabsList className="grid w-full grid-cols-2">
											<TabsTrigger value="characters" className="text-[10px]">Speakers</TabsTrigger>
											<TabsTrigger value="sequence" className="text-[10px]">Sequence</TabsTrigger>
										</TabsList>
									</Tabs>
								</div>
								<ScrollArea className="flex-1">
									<div className="p-2 space-y-1">
										{characters.map((char) => (
											<button 
												key={char.id}
												onClick={() => setActiveTab("characters")}
												className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-all text-left group border border-transparent hover:border-border"
											>
												<div className={cn(
													"size-10 rounded-full flex items-center justify-center text-lg shrink-0 border-2",
													char.gender === "female" ? "bg-pink-100 text-pink-600 border-pink-200" : 
													char.gender === "male" ? "bg-blue-100 text-blue-600 border-blue-200" :
													"bg-slate-100 text-slate-600 border-slate-200"
												)} style={{ borderColor: char.color }}>
													<HugeiconsIcon icon={UserIcon} className="size-5" />
												</div>
												<div className="flex-1 min-w-0">
													<p className="font-bold truncate text-sm group-hover:text-primary transition-colors">{char.name}</p>
													<div className="flex items-center gap-1.5 mt-0.5">
														<span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded uppercase tracking-tighter">
															{char.totalDuration.toFixed(1)}s
														</span>
														<span className="text-[10px] text-muted-foreground/30">•</span>
														<span className="text-[9px] text-muted-foreground">
															{segments.filter(s => s.speakerId === char.id).length} segments
														</span>
													</div>
												</div>
												{/* Per-speaker audio play */}
												{(() => {
													const speaker = speakers.find(s => s.id === char.id);
													return speaker?.audioUrl ? (
														<Button
															variant="ghost"
															size="icon"
															className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
															onClick={(e) => {
																e.stopPropagation();
																const audio = new Audio(speaker.audioUrl);
																audio.play();
															}}
														>
															<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
														</Button>
													) : null;
												})()}
											</button>
										))}
									</div>
								</ScrollArea>
							</div>

							{/* Main Content - Configuration / Sequence */}
							<div className="flex-1 flex flex-col overflow-hidden bg-background">
								<ScrollArea className="flex-1">
									<div className="p-6 space-y-8">
										{activeTab === "characters" ? (
											/* Speaker Verification Cards */
											<div className="space-y-4">
												<div className="flex items-center justify-between">
													<h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Speaker Verification</h4>
													<Badge variant="outline" className="text-[10px]">
														{speakers.filter(s => s.confirmed).length}/{speakers.length} confirmed
													</Badge>
												</div>
												{speakers.map((speaker) => (
													<SpeakerVerificationCard key={speaker.id} speaker={speaker} />
												))}
											</div>
										) : (
											/* Chronological Sequence View */
											<div className="space-y-4">
												<div className="flex items-center justify-between mb-2">
													<h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Chronological Flow</h4>
													<Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => {
														editor.playback.seek({ time: 0 });
														editor.playback.play();
													}}>
														<HugeiconsIcon icon={PlayIcon} className="size-3 mr-1" />
														Play All
													</Button>
												</div>
												<div className="space-y-2">
													{[...segments].sort((a, b) => a.start - b.start).map((seg, idx) => {
														const char = characters.find(c => c.id === seg.speakerId);
														// Highlighting logic based on editor playback time
														const currentTime = editor.playback.getCurrentTime();
														const isActive = currentTime >= seg.start && currentTime <= seg.end;

														return (
															<div 
																key={idx} 
																className={cn(
																	"flex gap-4 p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden",
																	isActive ? "border-primary bg-primary/5 shadow-md scale-[1.01]" : "bg-muted/10 border-border hover:bg-muted/30"
																)}
															>
																{isActive && (
																	<div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
																)}
																<div className="flex flex-col items-center gap-2 shrink-0">
																	<div className={cn(
																		"size-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2",
																		char?.gender === "female" ? "bg-pink-100 text-pink-600 border-pink-200" : 
																		char?.gender === "male" ? "bg-blue-100 text-blue-600 border-blue-200" :
																		"bg-slate-100 text-slate-600 border-slate-200"
																	)} style={{ borderColor: char?.color }}>
																		<HugeiconsIcon icon={UserIcon} className="size-5" />
																	</div>
																	<span className="text-[9px] font-mono text-muted-foreground font-bold">{seg.start.toFixed(1)}s</span>
																</div>
																<div className="flex-1 space-y-2">
																	<div className="flex items-center justify-between">
																		<div className="flex items-center gap-2">
																			<span className="text-xs font-bold text-foreground/70">{char?.name || "Unknown"}</span>
																			{char?.ttsVoiceId && (
																				<Badge variant="secondary" className="text-[10px] h-4 px-1 py-0 font-normal opacity-70">
																					{voices.find(v => v.id === char.ttsVoiceId)?.name || char.ttsVoiceId}
																				</Badge>
																			)}
																		</div>
																		<Button 
																			variant="ghost" 
																			size="icon" 
																			className="size-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
																			onClick={() => {
																				editor.playback.seek({ time: seg.start });
																				editor.playback.play();
																				setTimeout(() => editor.playback.pause(), (seg.end - seg.start) * 1000);
																			}}
																		>
																			<HugeiconsIcon icon={PlayIcon} className="size-4" />
																		</Button>
																	</div>
																	<div className="relative">
																		<p className={cn(
																			"text-sm leading-relaxed",
																			isActive ? "text-primary font-medium" : "text-foreground/80 italic font-normal"
																		)}>
																			"{seg.text}"
																		</p>
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											</div>
										)}
									</div>
								</ScrollArea>
								
								<div className="p-4 border-t bg-muted/20 flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<HugeiconsIcon icon={allSpeakersConfirmed() ? CheckmarkCircle01Icon : AlertCircleIcon} className={cn("size-4", allSpeakersConfirmed() ? "text-emerald-500" : "")} />
										<span>{allSpeakersConfirmed() ? "All speakers confirmed — ready to dub!" : "Please confirm all speakers before dubbing."}</span>
									</div>
									<div className="flex gap-2">
										<Button variant="outline" size="sm" onClick={() => setStep("choice")}>Back</Button>
										<Button 
											size="sm" 
											onClick={() => {
												if (!allSpeakersConfirmed()) {
													toast.warning("Please confirm all speakers before dubbing.");
													return;
												}
												handleDubAll();
											}}
											disabled={isDubbing || !allSpeakersConfirmed()}
										>
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

				{/* Active Transcript Overlay - Persists across tabs if playing */}
				{step === "configuration" && activeSegment && (
					<div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
						<div className="bg-black/80 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-2xl overflow-hidden relative group">
							<div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opaicty-50" />
							<div className="relative flex flex-col items-center text-center gap-1">
								<div className="flex items-center gap-2 mb-1">
									<Badge 
										variant="outline" 
										className="text-[10px] bg-primary/10 text-primary border-primary/20 backdrop-blur-sm px-2 py-0.5"
										style={{ borderColor: characters.find(c => c.id === activeSegment.speakerId)?.color }}
									>
										{characters.find(c => c.id === activeSegment.speakerId)?.name || "Speaker"}
									</Badge>
									<span className="text-[10px] text-white/50 font-mono">
										{activeSegment.start.toFixed(1)}s
									</span>
								</div>
								<p className="text-white text-base font-medium leading-tight">
									"{activeSegment.text}"
								</p>
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
