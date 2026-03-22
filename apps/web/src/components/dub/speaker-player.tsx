import React, { useEffect, useRef, useState } from "react";
import { SpeakerData, SpeakerSegment } from "@/hooks/use-dub";
import { getAudioBlob } from "@/lib/dub-storage";
import { cn } from "@/utils/ui";
import { User, Volume2, Clock } from "lucide-react";

interface SpeakerPlayerProps {
	speaker: SpeakerData;
	isActive: boolean;
	onSelect: () => void;
}

export function SpeakerPlayer({ speaker, isActive, onSelect }: SpeakerPlayerProps) {
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [currentTime, setCurrentTime] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

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
		if (isActive && activeSegmentIdx !== -1 && scrollRef.current) {
			const activeEl = scrollRef.current.children[activeSegmentIdx] as HTMLElement;
			if (activeEl) {
				activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		}
	}, [activeSegmentIdx, isActive]);

	return (
		<div 
			className={cn(
				"border rounded-xl transition-all overflow-hidden",
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
				<div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
					{audioUrl && (
						<audio 
							ref={audioRef}
							src={audioUrl} 
							controls 
							className="w-full h-10 rounded-lg shadow-inner bg-background" 
							onTimeUpdate={handleTimeUpdate}
							autoPlay
						/>
					)}

					<div 
						ref={scrollRef}
						className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20"
					>
						{speaker.segments.map((seg, idx) => (
							<div 
								key={idx}
								className={cn(
									"p-3 rounded-lg border text-sm transition-all",
									activeSegmentIdx === idx 
										? "bg-background border-primary/50 shadow-sm scale-[1.01]" 
										: "bg-muted/30 border-transparent text-muted-foreground"
								)}
							>
								<div className="flex items-center justify-between mb-1 opacity-50 text-[10px] font-mono">
									<span>{(seg.mergedStart || 0).toFixed(1)}s</span>
									<span>Video: {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s</span>
								</div>
								<p className={cn(
									"leading-relaxed",
									activeSegmentIdx === idx ? "text-foreground font-medium" : ""
								)}>
									{seg.text || "..."}
								</p>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
