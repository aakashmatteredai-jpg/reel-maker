import React, { useState, useEffect } from "react";
import { useDub } from "@/hooks/use-dub";
import { SpeakerPlayer } from "./speaker-player";
import { cn } from "@/utils/ui";
import { 
	Loader2, 
	CheckCircle2, 
	AlertCircle, 
	Settings2, 
	AudioLines, 
	Dna, 
	Scissors, 
	Combine 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function DubPanel() {
	const { state, reset } = useDub();
	const [activeSpeakerIdx, setActiveSpeakerIdx] = useState(0);

	const STAGES = [
		{ id: "extracting", label: "Extracting Audio", icon: AudioLines },
		{ id: "transcribing", label: "Generating Transcript", icon: Dna },
		{ id: "diarizing", label: "Detecting Speakers", icon: Settings2 },
		{ id: "slicing", label: "Slicing Segments", icon: Scissors },
		{ id: "merging", label: "Merging Chunks", icon: Combine },
	];

	const currentStageIdx = STAGES.findIndex(s => s.id === state.stage);

	return (
		<div className="flex flex-col h-full bg-background border-l w-[400px] shadow-2xl animate-in slide-in-from-right duration-300">
			<div className="p-6 border-b flex items-center justify-between bg-muted/10">
				<h3 className="font-bold text-lg flex items-center gap-2">
					<AudioLines className="size-5 text-primary" />
					Dubbing Process
				</h3>
				{state.stage === "done" && (
					<Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground h-8">
						New Dub
					</Button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-6 space-y-8">
				{state.stage === "error" ? (
					<div className="space-y-4 p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center animate-in zoom-in">
						<AlertCircle className="size-12 text-destructive mx-auto" />
						<div className="space-y-2">
							<h4 className="font-bold text-destructive">Process Failed</h4>
							<p className="text-sm text-destructive/80">{state.error}</p>
						</div>
						<Button onClick={reset} variant="destructive" className="w-full">
							Retry Process
						</Button>
					</div>
				) : state.stage === "done" ? (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
						<div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
							<CheckCircle2 className="size-6 shrink-0" />
							<div>
								<p className="text-sm font-bold">Successfully Dubbed!</p>
								<p className="text-xs opacity-80">{state.speakers.length} speakers detected in the video.</p>
							</div>
						</div>

						<div className="space-y-3">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
								Detected Speakers
							</h4>
							<div className="space-y-3">
								{state.speakers.map((s, idx) => (
									<SpeakerPlayer 
										key={s.id}
										speaker={s}
										isActive={activeSpeakerIdx === idx}
										onSelect={() => setActiveSpeakerIdx(idx)}
									/>
								))}
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-8 py-4">
						<div className="space-y-4 text-center">
							<div className="relative size-20 mx-auto">
								<Loader2 className="size-20 text-primary animate-spin opacity-20" />
								<div className="absolute inset-0 flex items-center justify-center">
									{React.createElement(STAGES[Math.max(0, currentStageIdx)]?.icon || Loader2, {
										className: "size-10 text-primary animate-pulse"
									})}
								</div>
							</div>
							<div className="space-y-2">
								<h4 className="text-xl font-bold capitalize">{state.stage.replace("_", " ")}</h4>
								<p className="text-sm text-muted-foreground px-8">
									Please wait while we process your video. This may take a few minutes.
								</p>
							</div>
						</div>

						<div className="space-y-4">
							<div className="flex justify-between text-xs font-bold font-mono">
								<span className="text-primary">{state.progress}%</span>
								<span className="text-muted-foreground">{currentStageIdx + 1} / {STAGES.length}</span>
							</div>
							<Progress value={state.progress} className="h-2 shadow-inner" />
						</div>

						<div className="space-y-2">
							{STAGES.map((s, idx) => (
								<div 
									key={s.id}
									className={cn(
										"flex items-center gap-3 p-3 rounded-lg text-sm transition-all",
										idx < currentStageIdx ? "text-emerald-500 opacity-60" :
										idx === currentStageIdx ? "text-primary font-bold bg-primary/5 border border-primary/20 scale-[1.02]" :
										"text-muted-foreground opacity-40"
									)}
								>
									{idx < currentStageIdx ? (
										<CheckCircle2 className="size-4 shrink-0" />
									) : idx === currentStageIdx ? (
										<Loader2 className="size-4 shrink-0 animate-spin" />
									) : (
										<div className="size-4 rounded-full border-2 border-current opacity-20" />
									)}
									{s.label}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
