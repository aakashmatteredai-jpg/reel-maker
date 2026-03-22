"use client";

import { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import {
	PlayIcon,
	PauseIcon,
	CheckmarkCircle01Icon,
	Edit01Icon,
	Cancel01Icon,
	Tick01Icon,
	UserIcon,
	Search01Icon,
	AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/hooks/use-editor";
import { useDubbingStore } from "@/stores/dubbing-store";
import type { DubbingSpeaker } from "@/types/transcription";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

interface SpeakerVerificationCardProps {
	speaker: DubbingSpeaker;
}

export function SpeakerVerificationCard({ speaker }: SpeakerVerificationCardProps) {
	const editor = useEditor();
	const { 
		confirmSpeaker, 
		unconfirmSpeaker, 
		updateSegmentText, 
		playingSpeakerId, 
		setPlayingSpeakerId,
		timelineMode,
		setTimelineMode
	} = useDubbingStore();

	const [currentAudioTime, setCurrentAudioTime] = useState(0);
	const [editingSegIdx, setEditingSegIdx] = useState<number | null>(null);
	const [editText, setEditText] = useState("");
	const [syncIssues, setSyncIssues] = useState<number[]>([]);
	
	const waveformRef = useRef<HTMLDivElement>(null);
	const wavesurfer = useRef<WaveSurfer | null>(null);
	const currentTime = editor.playback.getCurrentTime();

	const isPlaying = playingSpeakerId === speaker.id;

	// Initialize WaveSurfer
	useEffect(() => {
		if (waveformRef.current && speaker.audioUrl) {
			wavesurfer.current = WaveSurfer.create({
				container: waveformRef.current,
				waveColor: speaker.color + "40",
				progressColor: speaker.color,
				cursorColor: speaker.color,
				barWidth: 2,
				barGap: 3,
				height: 40,
				cursorWidth: 1,
				normalize: true,
			});

			wavesurfer.current.load(speaker.audioUrl);

			wavesurfer.current.on("play", () => setPlayingSpeakerId(speaker.id));
			wavesurfer.current.on("pause", () => {
				if (useDubbingStore.getState().playingSpeakerId === speaker.id) {
                    setPlayingSpeakerId(null);
                }
			});
			wavesurfer.current.on("finish", () => setPlayingSpeakerId(null));
			wavesurfer.current.on("timeupdate", (time) => setCurrentAudioTime(time));

			return () => {
				wavesurfer.current?.destroy();
			};
		}
	}, [speaker.audioUrl, speaker.color, setPlayingSpeakerId]);

	// Handle global playing state
	useEffect(() => {
		if (playingSpeakerId !== speaker.id && wavesurfer.current?.isPlaying()) {
			wavesurfer.current.pause();
		}
	}, [playingSpeakerId, speaker.id]);

	const handlePlaySpeakerAudio = () => {
		if (timelineMode) {
			if (speaker.segments.length === 0) return;
			const firstSeg = speaker.segments[0];
			editor.playback.seek({ time: firstSeg.start });
			editor.playback.play();
			setPlayingSpeakerId(speaker.id);
			return;
		}

		if (!wavesurfer.current) return;
		wavesurfer.current.playPause();
	};

    // Handle editor playback state
    useEffect(() => {
        if (timelineMode && !editor.playback.getIsPlaying() && playingSpeakerId === speaker.id) {
            setPlayingSpeakerId(null);
        }
    }, [editor.playback.getIsPlaying(), timelineMode, playingSpeakerId, speaker.id]);

    // Auto-scroll transcript
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const activeIdx = getActiveSegmentIdx();
        if (activeIdx >= 0 && scrollContainerRef.current) {
            const activeEl = scrollContainerRef.current.children[activeIdx] as HTMLElement;
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    }, [currentAudioTime, currentTime, timelineMode]);

	const getActiveSegmentIdx = (): number => {
		if (timelineMode && editor.playback.getIsPlaying()) {
			return speaker.segments.findIndex(s => currentTime >= s.start && currentTime <= s.end);
		}
		// For isolated audio, map by cumulative duration
		let cumulative = 0;
		for (let i = 0; i < speaker.segments.length; i++) {
			const dur = speaker.segments[i].end - speaker.segments[i].start;
			if (currentAudioTime >= cumulative && currentAudioTime < cumulative + dur) {
				return i;
			}
			cumulative += dur;
		}
		return -1;
	};

	const activeIdx = getActiveSegmentIdx();

	const handleVerifySync = () => {
		const issues: number[] = [];
		speaker.segments.forEach((seg, idx) => {
			const duration = seg.end - seg.start;
			const wordCount = seg.text.split(/\s+/).length;
			const wpm = (wordCount / duration) * 60;
			
			// Heuristic: suspicious if > 250 WPM (too fast) or < 50 WPM (too slow)
			if (wpm > 250 || (wpm < 50 && duration > 2)) {
				issues.push(idx);
			}
		});
		setSyncIssues(issues);
		if (issues.length === 0) {
			toast.success("No major sync issues detected!");
		} else {
			toast.warning(`${issues.length} suspicious segments found.`);
		}
	};

	const handleStartEdit = (idx: number) => {
		setEditingSegIdx(idx);
		setEditText(speaker.segments[idx].text);
	};

	const handleSaveEdit = () => {
		if (editingSegIdx === null) return;
		updateSegmentText(speaker.id, editingSegIdx, editText);
		setEditingSegIdx(null);
		setEditText("");
		if (speaker.confirmed) unconfirmSpeaker(speaker.id);
	};

	const handleCancelEdit = () => {
		setEditingSegIdx(null);
		setEditText("");
	};

	return (
		<div
			className={cn(
				"rounded-xl border-2 p-5 transition-all space-y-4 relative group",
				speaker.confirmed
					? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/10"
					: "border-border bg-card shadow-sm hover:shadow-md"
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className="size-10 rounded-full flex items-center justify-center border-2 shrink-0 shadow-sm"
						style={{ borderColor: speaker.color, backgroundColor: speaker.color + "15" }}
					>
						<HugeiconsIcon icon={UserIcon} className="size-5" style={{ color: speaker.color }} />
					</div>
					<div>
						<h4 className="font-bold text-sm tracking-tight">{speaker.name}</h4>
						<div className="flex items-center gap-2 mt-0.5">
							<Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize font-mono">
								{speaker.gender}
							</Badge>
							<span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
								{speaker.totalDuration.toFixed(1)}s
							</span>
							<span className="text-[10px] text-muted-foreground font-medium">
								• {speaker.segments.length} segments
							</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-8 text-muted-foreground hover:text-primary transition-colors"
						onClick={handleVerifySync}
						title="Verify Sync"
					>
						<HugeiconsIcon icon={Search01Icon} className="size-4" />
					</Button>
					{speaker.confirmed && (
						<Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] gap-1 px-2 py-0.5 animate-in fade-in scale-in">
							<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
							Confirmed
						</Badge>
					)}
				</div>
			</div>

			{/* Audio Controls & Waveform */}
			<div className="bg-muted/30 rounded-lg p-3 space-y-3">
				<div className="flex items-center gap-3">
					<Button
						variant={isPlaying ? "default" : "outline"}
						size="sm"
						className="h-8 w-full text-xs gap-1.5 shadow-sm transition-all"
						disabled={!speaker.audioUrl && !timelineMode}
						onClick={handlePlaySpeakerAudio}
					>
						<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} className="size-3.5" />
						{isPlaying 
							? (timelineMode ? "Pause Video" : "Pause Audio") 
							: (timelineMode ? "Play in Timeline" : "Play Speaker Audio")}
					</Button>
					
					<div className="flex-1 flex items-center gap-2 text-[10px] font-mono text-muted-foreground justify-end shrink-0">
						<span>{(timelineMode ? currentTime : currentAudioTime).toFixed(1)}s</span>
						<span className="opacity-30">/</span>
						<span>{(timelineMode ? editor.timeline.getTotalDuration() : speaker.totalDuration).toFixed(1)}s</span>
					</div>
				</div>
				
				{!timelineMode && <div ref={waveformRef} className="w-full h-10 rounded overflow-hidden" />}
			</div>

			{/* Transcript Segments */}
			<div 
				ref={scrollContainerRef}
				className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20"
			>
				{speaker.segments.map((seg, idx) => (
					<div
						key={idx}
						className={cn(
							"flex items-start gap-3 p-2.5 rounded-xl transition-all text-sm border group/seg",
							activeIdx === idx
								? "bg-primary/10 border-primary/30 shadow-sm scale-[1.01]"
								: "bg-muted/10 border-transparent hover:bg-muted/40",
							syncIssues.includes(idx) && !speaker.confirmed && "border-amber-500/30 bg-amber-500/5"
						)}
					>
						<div className="flex flex-col items-center gap-1 shrink-0 w-12 pt-0.5">
							<span className="text-[9px] font-mono text-muted-foreground tabular-nums">
								{seg.start.toFixed(1)}s
							</span>
							{syncIssues.includes(idx) && (
								<HugeiconsIcon icon={AlertCircleIcon} className="size-3 text-amber-500" />
							)}
						</div>

						{editingSegIdx === idx ? (
							<div className="flex-1 space-y-2">
								<Textarea
									value={editText}
									onChange={(e) => setEditText(e.target.value)}
									className="min-h-[80px] text-xs resize-none bg-background shadow-inner"
									autoFocus
								/>
								<div className="flex gap-1.5">
									<Button size="sm" className="h-7 text-[10px] gap-1 px-3" onClick={handleSaveEdit}>
										<HugeiconsIcon icon={Tick01Icon} className="size-3" />
										Save
									</Button>
									<Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-3" onClick={handleCancelEdit}>
										<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<>
								<div className="flex-1">
									<p className={cn(
										"text-[13px] leading-relaxed transition-colors",
										activeIdx === idx ? "text-primary font-semibold" : "text-foreground/80 font-normal"
									)}>
										{seg.text}
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="size-7 shrink-0 opacity-0 group-hover/seg:opacity-100 hover:bg-primary/10 hover:text-primary transition-all rounded-full"
									onClick={() => handleStartEdit(idx)}
								>
									<HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
								</Button>
							</>
						)}
					</div>
				))}
			</div>

			{/* Confirm / Unconfirm */}
			<div className="flex items-center justify-between pt-3 border-t border-border/50">
				{speaker.confirmed ? (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
						onClick={() => unconfirmSpeaker(speaker.id)}
					>
						Undo Confirmation
					</Button>
				) : (
					<Button
						size="sm"
						className="h-9 px-4 text-xs gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-md transition-all active:scale-95"
						onClick={() => confirmSpeaker(speaker.id)}
					>
						<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
						Confirm Speaker
					</Button>
				)}

				<div className="flex flex-col items-end gap-1">
					{speaker.ttsVoiceId && (
						<Badge variant="secondary" className="text-[9px] h-4 px-2 font-mono opacity-80">
							{speaker.ttsProvider}/{speaker.ttsVoiceId}
						</Badge>
					)}
					<span className="text-[10px] text-muted-foreground/60 italic">
						Verified: {speaker.confirmed ? "Yes" : "No"}
					</span>
				</div>
			</div>
		</div>
	);
}
