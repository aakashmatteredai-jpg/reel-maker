"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/utils/ui";
import type { DubbingSegment } from "@/types/transcription";
import { useDubbingStore } from "@/stores/dubbing-store";
import { useEditor } from "@/hooks/use-editor";
import { MoveHorizontal, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SpeakerTimelineProps {
	speakerId: string;
	segments: DubbingSegment[];
	color: string;
	totalDuration: number;
}

export function SpeakerTimeline({ speakerId, segments, color, totalDuration }: SpeakerTimelineProps) {
	const { isEditMode, updateSegmentTiming } = useDubbingStore();
	const editor = useEditor();
	const containerRef = useRef<HTMLDivElement>(null);
	
	const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
	const [dragType, setDragType] = useState<"move" | "resize-left" | "resize-right" | null>(null);
	const [dragStartPos, setDragStartPos] = useState({ x: 0, start: 0, end: 0 });

	const getPosFromTime = (time: number) => (time / totalDuration) * 100;
	const getTimeFromPos = (clientX: number) => {
		if (!containerRef.current) return 0;
		const rect = containerRef.current.getBoundingClientRect();
		const relativeX = clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
		return Math.round(ratio * totalDuration * 10) / 10; // Snap to 0.1s
	};

	const onPointerDown = (e: React.PointerEvent, idx: number, type: "move" | "resize-left" | "resize-right") => {
		if (!isEditMode) {
			// Seek video in view mode
			editor.playback.seek({ time: segments[idx].start });
			return;
		}
		
		e.stopPropagation();
		setDraggingIdx(idx);
		setDragType(type);
		setDragStartPos({
			x: e.clientX,
			start: segments[idx].start,
			end: segments[idx].end,
		});
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (draggingIdx === null || !dragType || !isEditMode) return;

		const currentTime = getTimeFromPos(e.clientX);
		const segment = segments[draggingIdx];
		const prevSegment = segments[draggingIdx - 1];
		const nextSegment = segments[draggingIdx + 1];

		let newStart = segment.start;
		let newEnd = segment.end;

		const minDuration = 0.5;

		if (dragType === "move") {
			const delta = currentTime - getTimeFromPos(dragStartPos.x);
			newStart = Math.max(0, dragStartPos.start + delta);
			newEnd = newStart + (dragStartPos.end - dragStartPos.start);
			
			// Overlap prevention
			if (prevSegment && newStart < prevSegment.end) {
				newStart = prevSegment.end;
				newEnd = newStart + (dragStartPos.end - dragStartPos.start);
			}
			if (nextSegment && newEnd > nextSegment.start) {
				newEnd = nextSegment.start;
				newStart = newEnd - (dragStartPos.end - dragStartPos.start);
			}
		} else if (dragType === "resize-left") {
			newStart = Math.min(segment.end - minDuration, currentTime);
			if (prevSegment && newStart < prevSegment.end) newStart = prevSegment.end;
		} else if (dragType === "resize-right") {
			newEnd = Math.max(segment.start + minDuration, currentTime);
			if (nextSegment && newEnd > nextSegment.start) newEnd = nextSegment.start;
		}

		if (newStart !== segment.start || newEnd !== segment.end) {
			updateSegmentTiming(speakerId, draggingIdx, newStart, newEnd);
		}
	};

	const onPointerUp = (e: React.PointerEvent) => {
		setDraggingIdx(null);
		setDragType(null);
	};

	return (
		<div className="space-y-2 py-4">
			<div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
				<span>Timeline</span>
				<span>{totalDuration.toFixed(1)}s</span>
			</div>
			
			<div 
				ref={containerRef}
				className={cn(
					"relative h-12 w-full rounded-lg bg-secondary/30 border border-border/50 overflow-hidden",
					isEditMode ? "cursor-crosshair" : "cursor-pointer"
				)}
				onPointerMove={onPointerMove}
			>
				{/* Background Grid Lines (1s intervals) */}
				{Array.from({ length: Math.ceil(totalDuration) }).map((_, i) => (
					<div 
						key={i}
						className="absolute top-0 bottom-0 border-l border-border/20"
						style={{ left: `${getPosFromTime(i)}%` }}
					/>
				))}

				{/* Segments */}
				{segments.map((seg, idx) => {
					const left = getPosFromTime(seg.start);
					const width = getPosFromTime(seg.end - seg.start);
					const isActive = draggingIdx === idx;

					return (
						<div
							key={idx}
							className={cn(
								"absolute top-1 bottom-1 rounded-md border shadow-sm transition-all duration-75 select-none",
								isActive ? "z-20 scale-y-105 shadow-lg" : "z-10",
								isEditMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:brightness-110"
							)}
							style={{ 
								left: `${left}%`, 
								width: `${width}%`,
								backgroundColor: color + "20",
								borderColor: color
							}}
							onPointerDown={(e) => onPointerDown(e, idx, "move")}
							onPointerUp={onPointerUp}
						>
							{/* Content */}
							<div className="flex h-full items-center px-1 overflow-hidden">
								<span className="text-[10px] font-bold truncate opacity-80" style={{ color }}>
									{seg.start.toFixed(1)}s
								</span>
							</div>

							{/* Resize Handles (Edit Mode only) */}
							{isEditMode && width > 5 && (
								<>
									<div 
										className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 transition-colors"
										onPointerDown={(e) => onPointerDown(e, idx, "resize-left")}
									/>
									<div 
										className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 transition-colors"
										onPointerDown={(e) => onPointerDown(e, idx, "resize-right")}
									/>
								</>
							)}

							{/* Drag Indicator */}
							{isActive && dragType === "move" && (
								<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-0.5 rounded shadow-md border animate-in fade-in zoom-in">
									{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
								</div>
							)}
						</div>
					);
				})}

				{/* Playhead Marker */}
				<div 
					className="absolute top-0 bottom-0 w-px bg-primary z-30 transition-all duration-100 ease-linear"
					style={{ left: `${getPosFromTime(editor.playback.getCurrentTime())}%` }}
				>
					<div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
				</div>
			</div>
		</div>
	);
}
