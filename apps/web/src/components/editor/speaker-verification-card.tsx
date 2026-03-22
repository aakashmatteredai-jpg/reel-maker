"use client";

import { useState, useRef, useEffect } from "react";
import {
	PlayIcon,
	PauseIcon,
	CheckmarkCircle01Icon,
	Edit01Icon,
	Cancel01Icon,
	Tick01Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/hooks/use-editor";
import { useDubbingStore } from "@/stores/dubbing-store";
import type { DubbingSpeaker } from "@/types/transcription";
import { cn } from "@/utils/ui";

interface SpeakerVerificationCardProps {
	speaker: DubbingSpeaker;
}

export function SpeakerVerificationCard({ speaker }: SpeakerVerificationCardProps) {
	const editor = useEditor();
	const { confirmSpeaker, unconfirmSpeaker, updateSegmentText } = useDubbingStore();

	const [isPlaying, setIsPlaying] = useState(false);
	const [currentAudioTime, setCurrentAudioTime] = useState(0);
	const [timelineMode, setTimelineMode] = useState(false);
	const [editingSegIdx, setEditingSegIdx] = useState<number | null>(null);
	const [editText, setEditText] = useState("");
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const currentTime = editor.playback.getCurrentTime();

	// Cleanup audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	const handlePlaySpeakerAudio = () => {
		if (!speaker.audioUrl) return;

		if (isPlaying && audioRef.current) {
			audioRef.current.pause();
			setIsPlaying(false);
			return;
		}

		if (!audioRef.current) {
			audioRef.current = new Audio(speaker.audioUrl);
			audioRef.current.addEventListener("ended", () => setIsPlaying(false));
			audioRef.current.addEventListener("timeupdate", () => {
				setCurrentAudioTime(audioRef.current?.currentTime || 0);
			});
		}

		audioRef.current.play();
		setIsPlaying(true);
	};

	const handleTimelinePlay = () => {
		if (speaker.segments.length === 0) return;
		const firstSeg = speaker.segments[0];
		editor.playback.seek({ time: firstSeg.start });
		editor.playback.play();
		setTimelineMode(true);
	};

	const getActiveSegmentIdx = (): number => {
		if (timelineMode) {
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

	const handleStartEdit = (idx: number) => {
		setEditingSegIdx(idx);
		setEditText(speaker.segments[idx].text);
	};

	const handleSaveEdit = () => {
		if (editingSegIdx === null) return;
		updateSegmentText(speaker.id, editingSegIdx, editText);
		setEditingSegIdx(null);
		setEditText("");
		// Un-confirm if text was changed
		if (speaker.confirmed) {
			unconfirmSpeaker(speaker.id);
		}
	};

	const handleCancelEdit = () => {
		setEditingSegIdx(null);
		setEditText("");
	};

	const confirmedCount = speaker.segments.length;
	const totalDur = speaker.totalDuration;

	return (
		<div
			className={cn(
				"rounded-xl border-2 p-5 transition-all space-y-4",
				speaker.confirmed
					? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/10"
					: "border-border bg-card"
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className="size-10 rounded-full flex items-center justify-center border-2 shrink-0"
						style={{ borderColor: speaker.color, backgroundColor: speaker.color + "15" }}
					>
						<HugeiconsIcon icon={UserIcon} className="size-5" style={{ color: speaker.color }} />
					</div>
					<div>
						<h4 className="font-bold text-sm">{speaker.name}</h4>
						<div className="flex items-center gap-2 mt-0.5">
							<Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
								{speaker.gender}
							</Badge>
							<span className="text-[10px] font-mono text-muted-foreground">
								{totalDur.toFixed(1)}s
							</span>
							<span className="text-[10px] text-muted-foreground">
								• {confirmedCount} segments
							</span>
						</div>
					</div>
				</div>

				{speaker.confirmed && (
					<Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] gap-1">
						<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
						Confirmed
					</Badge>
				)}
			</div>

			{/* Audio Controls */}
			<div className="flex items-center gap-2">
				<Button
					variant={isPlaying ? "default" : "outline"}
					size="sm"
					className="h-8 text-xs gap-1.5"
					disabled={!speaker.audioUrl}
					onClick={handlePlaySpeakerAudio}
				>
					<HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} className="size-3.5" />
					{isPlaying ? "Pause" : "Play Audio"}
				</Button>

				<Button
					variant={timelineMode ? "default" : "outline"}
					size="sm"
					className="h-8 text-xs gap-1.5"
					onClick={handleTimelinePlay}
				>
					<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
					Timeline Mode
				</Button>
			</div>

			{/* Transcript Segments with Live Sync */}
			<div className="space-y-1.5 max-h-[200px] overflow-y-auto">
				{speaker.segments.map((seg, idx) => (
					<div
						key={idx}
						className={cn(
							"flex items-start gap-2 p-2 rounded-lg transition-all text-sm border",
							activeIdx === idx
								? "bg-primary/10 border-primary/30 shadow-sm"
								: "bg-muted/20 border-transparent hover:bg-muted/40"
						)}
					>
						<span className="text-[9px] font-mono text-muted-foreground mt-1 shrink-0 w-12 text-right tabular-nums">
							{seg.start.toFixed(1)}s
						</span>

						{editingSegIdx === idx ? (
							<div className="flex-1 space-y-1.5">
								<Textarea
									value={editText}
									onChange={(e) => setEditText(e.target.value)}
									className="min-h-[60px] text-xs resize-none"
									autoFocus
								/>
								<div className="flex gap-1.5">
									<Button size="sm" className="h-6 text-[10px] gap-1" onClick={handleSaveEdit}>
										<HugeiconsIcon icon={Tick01Icon} className="size-3" />
										Save
									</Button>
									<Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={handleCancelEdit}>
										<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<>
								<p className={cn(
									"flex-1 text-xs leading-relaxed",
									activeIdx === idx ? "text-primary font-medium" : "text-foreground/80"
								)}>
									{seg.text}
								</p>
								<Button
									variant="ghost"
									size="icon"
									className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
									onClick={() => handleStartEdit(idx)}
								>
									<HugeiconsIcon icon={Edit01Icon} className="size-3" />
								</Button>
							</>
						)}
					</div>
				))}
			</div>

			{/* Confirm / Unconfirm */}
			<div className="flex items-center justify-between pt-2 border-t">
				{speaker.confirmed ? (
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs text-muted-foreground"
						onClick={() => unconfirmSpeaker(speaker.id)}
					>
						Undo Confirmation
					</Button>
				) : (
					<Button
						size="sm"
						className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
						onClick={() => confirmSpeaker(speaker.id)}
					>
						<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
						Confirm Speaker
					</Button>
				)}

				{speaker.ttsVoiceId && (
					<Badge variant="secondary" className="text-[9px] h-4 px-1.5">
						Voice: {speaker.ttsProvider} / {speaker.ttsVoiceId}
					</Badge>
				)}
			</div>
		</div>
	);
}
