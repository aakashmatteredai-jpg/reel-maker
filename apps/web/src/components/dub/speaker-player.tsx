import React, { useEffect, useRef, useState } from "react";
import { getAudioBlob } from "@/lib/dub-storage";
import { cn } from "@/utils/ui";
import { User, Volume2, Clock, Edit2, Check, X as CloseIcon } from "lucide-react";
import { useEditor } from "@/hooks/use-editor";
import type { SpeakerData, SpeakerSegment } from "@/core/managers/dub-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SpeakerPlayerProps {
	speaker: SpeakerData;
	isActive: boolean;
	onSelect: () => void;
}

export function SpeakerPlayer({ speaker, isActive, onSelect }: SpeakerPlayerProps) {
	const editor = useEditor();
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [currentTime, setCurrentTime] = useState(0);
	const [editingIdx, setEditingIdx] = useState<number | null>(null);
	const audioRef = useRef<HTMLAudioElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Temp state for editing
	const [editVal, setEditVal] = useState<Partial<SpeakerSegment>>({});

	useEffect(() => {
		async function loadAudio() {
			const blob = await getAudioBlob(speaker.mergedAudioKey);
			if (blob) {
				setAudioUrl(URL.createObjectURL(blob));
			}
		}
		loadAudio();
		return () => {
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	}, [speaker.mergedAudioKey]);

	const handleTimeUpdate = () => {
		if (audioRef.current) {
			setCurrentTime(audioRef.current.currentTime);
		}
	};

	const activeSegmentIdx = speaker.segments.findIndex((seg, idx) => {
		const nextSeg = speaker.segments[idx + 1];
		return currentTime >= (seg.mergedStart || 0) && (!nextSeg || currentTime < (nextSeg.mergedStart || 0));
	});

	useEffect(() => {
		if (isActive && activeSegmentIdx !== -1 && scrollRef.current && editingIdx === null) {
			const activeEl = scrollRef.current.children[activeSegmentIdx] as HTMLElement;
			if (activeEl) {
				activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		}
	}, [activeSegmentIdx, isActive, editingIdx]);

	const startEdit = (idx: number, seg: SpeakerSegment) => {
		setEditingIdx(idx);
		setEditVal(seg);
	};

	const saveEdit = () => {
		if (editingIdx !== null) {
			editor.dub.updateSpeakerSegment(speaker.id, editingIdx, editVal);
			setEditingIdx(null);
		}
	};

	return (
		<div 
			className={cn(
				"border rounded-xl transition-all overflow-hidden flex flex-col",
				isActive ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md" : "border-border bg-card hover:bg-accent/50 cursor-pointer"
			)}
			onClick={!isActive ? onSelect : undefined}
		>
			<div className="p-4 flex items-center justify-between border-b bg-muted/30">
				<div className="flex items-center gap-3">
					<div className="size-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
						<User className="size-5 text-primary" />
					</div>
					<div>
						<h4 className="font-bold text-sm tracking-tight capitalize">{speaker.id.replace("_", " ")}</h4>
						<div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
							<Clock className="size-3" />
							<span>{speaker.totalDuration.toFixed(1)}s</span>
							<span>•</span>
							<span>{speaker.segments.length} segments</span>
						</div>
					</div>
				</div>
				{isActive && <Volume2 className="size-4 text-primary animate-pulse" />}
			</div>

			{isActive && (
				<div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 flex-1 flex flex-col min-h-0">
					{audioUrl && (
						<audio 
							ref={audioRef}
							src={audioUrl} 
							controls 
							className="w-full h-10 rounded-lg shadow-inner bg-background shrink-0" 
							onTimeUpdate={handleTimeUpdate}
							autoPlay
						/>
					)}

					<div 
						ref={scrollRef}
						className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 min-h-[200px]"
					>
						{speaker.segments.map((seg, idx) => (
							<div 
								key={idx}
								className={cn(
									"group p-3 rounded-lg border text-sm transition-all relative",
									activeSegmentIdx === idx 
										? "bg-background border-primary/50 shadow-sm scale-[1.01]" 
										: "bg-muted/30 border-transparent text-muted-foreground"
								)}
							>
								{editingIdx === idx ? (
									<div className="space-y-3 p-1">
										<div className="flex items-center gap-2">
											<div className="grid grid-cols-2 gap-2 flex-1">
												<div className="space-y-1">
													<label className="text-[10px] font-bold uppercase text-muted-foreground">Start (s)</label>
													<Input 
														type="number" 
														step="0.1"
														value={editVal.start}
														onChange={e => setEditVal({...editVal, start: parseFloat(e.target.value)})}
														className="h-7 text-xs px-2"
													/>
												</div>
												<div className="space-y-1">
													<label className="text-[10px] font-bold uppercase text-muted-foreground">End (s)</label>
													<Input 
														type="number" 
														step="0.1"
														value={editVal.end}
														onChange={e => setEditVal({...editVal, end: parseFloat(e.target.value)})}
														className="h-7 text-xs px-2"
													/>
												</div>
											</div>
											<div className="flex flex-col gap-1">
												<Button size="icon" variant="ghost" className="size-7 text-emerald-500 hover:bg-emerald-50" onClick={saveEdit}>
													<Check className="size-4" />
												</Button>
												<Button size="icon" variant="ghost" className="size-7 text-destructive hover:bg-destructive/5" onClick={() => setEditingIdx(null)}>
													<CloseIcon className="size-4" />
												</Button>
											</div>
										</div>
										<Textarea 
											value={editVal.text}
											onChange={e => setEditVal({...editVal, text: e.target.value})}
											className="min-h-[60px] text-xs py-2 leading-relaxed resize-none"
										/>
									</div>
								) : (
									<>
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2 opacity-50 text-[10px] font-mono">
												<span className="bg-primary/10 text-primary px-1 rounded">{(seg.mergedStart || 0).toFixed(1)}s</span>
												<span>Video: {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s</span>
											</div>
											<Button 
												variant="ghost" 
												size="icon" 
												className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={(e) => {
													e.stopPropagation();
													startEdit(idx, seg);
												}}
											>
												<Edit2 className="size-3" />
											</Button>
										</div>
										<p className={cn(
											"leading-relaxed",
											activeSegmentIdx === idx ? "text-foreground font-medium" : ""
										)}>
											{seg.text || "..."}
										</p>
									</>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
