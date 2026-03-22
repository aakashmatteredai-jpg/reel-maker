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
	Combine,
	Languages,
	Mic2,
	ChevronRight,
	ArrowLeft,
	Sparkles
} from "lucide-react";
import { useEditor } from "@/hooks/use-editor";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DUB_LANGUAGES } from "@/lib/voices";
import { 
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type WizardStep = "review" | "language" | "voices" | "ready";

export function DubPanel() {
	const editor = useEditor();
	const { state, reset, translateTranscript, generateDub, applyToTimeline } = useDub();
	const [activeSpeakerIdx, setActiveSpeakerIdx] = useState(0);
	const [step, setStep] = useState<WizardStep>("review");
	const [selectedLang, setSelectedLang] = useState<string>("hi-IN");

	const STAGES = [
		{ id: "extracting", label: "Extracting Audio", icon: AudioLines },
		{ id: "diarizing", label: "Detecting Speakers", icon: Settings2 },
		{ id: "transcribing", label: "Per-Segment Transcription", icon: Dna },
		{ id: "translating", label: "Groq Translation", icon: Languages },
		{ id: "dubbing", label: "Generating AI Voices", icon: Mic2 },
	];

	const currentStageIdx = STAGES.findIndex(s => s.id === state.stage);

	// Auto-navigate steps based on progress
	useEffect(() => {
		if (state.stage === "done" && step === "review" && state.speakers.length > 0) {
			// Stay in review
		}
		if (state.stage === "translating") setStep("language");
		if (state.stage === "dubbing") setStep("voices");
	}, [state.stage]);

	const handleNext = () => {
		if (step === "review") setStep("language");
		else if (step === "language") {
			translateTranscript(selectedLang);
		}
		else if (step === "voices") {
			generateDub();
		}
	};

	const handleBack = () => {
		if (step === "language") setStep("review");
		else if (step === "voices") setStep("language");
	};

	// If translation finished, move to voices
	useEffect(() => {
		if (state.targetTranscript && step === "language" && state.stage === "done") {
			setStep("voices");
			
			// Initialize default voices if not set
			const updatedSpeakers = state.speakers.map(s => {
				if (!s.voiceId) {
					return {
						...s,
						voiceProvider: (s.id.includes("female") ? "elevenlabs" : "sarvam") as "elevenlabs" | "sarvam",
						voiceId: s.id.includes("female") ? "21m00Tcm4TlvDq8ikWAM" : "mahesh" // Rachel and Mahesh
					};
				}
				return s;
			});
			
			// Only update if changes were made to avoid infinite loops
			if (JSON.stringify(updatedSpeakers) !== JSON.stringify(state.speakers)) {
				editor.dub.updateState({ speakers: updatedSpeakers });
			}
		}
	}, [state.targetTranscript, state.stage, state.speakers, step]);

	return (
		<div className="flex flex-col h-full bg-background min-w-[600px] animate-in fade-in duration-500">
			<div className="p-6 border-b flex items-center justify-between bg-muted/5">
				<div className="space-y-1">
					<h3 className="font-bold text-xl flex items-center gap-2 tracking-tight">
						<Sparkles className="size-5 text-primary" />
						AI Dubbing Studio
					</h3>
					<p className="text-xs text-muted-foreground font-medium">Professional Multilingual Dubbing</p>
				</div>
				<div className="flex items-center gap-2">
					{state.stage === "done" && (
						<Button variant="outline" size="sm" onClick={reset} className="h-8 text-xs">
							Reset
						</Button>
					)}
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto p-8">
				{state.stage === "error" ? (
					<div className="max-w-md mx-auto space-y-6 pt-12 animate-in zoom-in-95">
						<div className="size-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/20 text-destructive">
							<AlertCircle className="size-10" />
						</div>
						<div className="space-y-2 text-center">
							<h4 className="font-bold text-xl">Process Failed</h4>
							<p className="text-sm text-muted-foreground">{state.error}</p>
						</div>
						<Button onClick={reset} variant="destructive" className="w-full h-12 rounded-xl">
							Retry Process
						</Button>
					</div>
				) : state.stage === "done" || state.stage === "translating" || state.stage === "dubbing" ? (
					<div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
						{/* Step Progress Header */}
						<div className="flex items-center justify-between px-2 mb-8 relative">
							<div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10 -translate-y-1/2" />
							{[
								{ id: "review", label: "Verification", icon: CheckCircle2 },
								{ id: "language", label: "Translation", icon: Languages },
								{ id: "voices", label: "Voice Casting", icon: Mic2 },
							].map((s, i) => (
								<div key={s.id} className="flex flex-col items-center gap-2 bg-background px-4">
									<div className={cn(
										"size-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
										step === s.id ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg" : 
										i < ["review", "language", "voices"].indexOf(step) ? "bg-emerald-500 border-emerald-500 text-white" :
										"bg-muted border-muted-foreground/20 text-muted-foreground"
									)}>
										<s.icon className="size-5" />
									</div>
									<span className={cn("text-[10px] font-bold uppercase tracking-wider", step === s.id ? "text-primary" : "text-muted-foreground")}>
										{s.label}
									</span>
								</div>
							))}
						</div>

						{/* Step Content */}
						<div className="min-h-[400px]">
							{step === "review" && (
								<div className="space-y-6">
									<div className="space-y-2">
										<h4 className="text-lg font-bold italic">Verify Speakers & Text</h4>
										<p className="text-sm text-muted-foreground">Review the detected speakers and their transcripts for accuracy.</p>
									</div>
									<div className="grid grid-cols-1 gap-4">
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
							)}

							{step === "language" && (
								<div className="max-w-md mx-auto space-y-8 py-12 text-center animate-in zoom-in-95">
									<div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
										<Languages className="size-10 text-primary" />
									</div>
									<div className="space-y-4">
										<div className="space-y-2">
											<h4 className="text-2xl font-bold italic tracking-tight">Target language</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												Select the language you want to translate the video into. We use Groq Cloud (Llama 3.3 70B) for near-native accuracy.
											</p>
										</div>
										<Select value={selectedLang} onValueChange={setSelectedLang}>
											<SelectTrigger className="w-full h-14 text-lg rounded-xl border-2 hover:border-primary transition-all">
												<SelectValue placeholder="Select Language" />
											</SelectTrigger>
											<SelectContent>
												{DUB_LANGUAGES.map(lang => (
													<SelectItem key={lang.code} value={lang.code} className="text-lg py-3">
														{lang.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							)}

							{step === "voices" && (
								<div className="space-y-6">
									<div className="space-y-2">
										<h4 className="text-lg font-bold italic">Voice Casting</h4>
										<p className="text-sm text-muted-foreground">Select a professional AI voice for each speaker to match the translation.</p>
									</div>
									<div className="grid grid-cols-1 gap-4">
										{state.speakers.map((s, idx) => (
											<SpeakerPlayer 
												key={s.id}
												speaker={s}
												isActive={activeSpeakerIdx === idx}
												onSelect={() => setActiveSpeakerIdx(idx)}
												mode="voice-selection"
											/>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Footer Actions */}
						<div className="flex items-center justify-between pt-8 border-t">
							<Button 
								variant="ghost" 
								onClick={handleBack} 
								disabled={step === "review" || state.stage !== "done"}
								className="gap-2"
							>
								<ArrowLeft className="size-4" />
								Back
							</Button>
							
							<Button 
								onClick={handleNext}
								className="gap-2 h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/20"
								disabled={state.stage !== "done"}
							>
								{state.stage !== "done" ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										{state.stage === "translating" ? "Translating..." : "Dubbing..."}
									</>
								) : (
									<>
										{step === "review" ? "Confirm Detections" : 
										 step === "language" ? "Translate Transcript" : 
										 step === "voices" ? "Generate Final Dub" : "Apply to Timeline"}
										<ChevronRight className="size-4" />
									</>
								)}
							</Button>
						</div>
					</div>
				) : (
					<div className="max-w-md mx-auto space-y-12 py-12">
						<div className="space-y-6 text-center">
							<div className="relative size-32 mx-auto">
								<div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-[ping_3s_linear_infinite]" />
								<div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-[ping_2s_linear_infinite]" />
								<div className="relative size-32 rounded-full bg-card shadow-2xl flex items-center justify-center border-2 border-primary/20">
									{React.createElement(STAGES[Math.max(0, currentStageIdx)]?.icon || Loader2, {
										className: "size-16 text-primary animate-pulse"
									})}
								</div>
							</div>
							<div className="space-y-3">
								<h4 className="text-3xl font-bold italic tracking-tighter capitalize">{state.stage.replace("_", " ")}</h4>
								<p className="text-sm text-muted-foreground leading-relaxed px-12">
									We're performing deep analysis on your video. This involves complex AI model switching.
								</p>
							</div>
						</div>

						<div className="space-y-6">
							<div className="space-y-2">
								<div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
									<span>Pipeline Progress</span>
									<span>{state.progress}%</span>
								</div>
								<Progress value={state.progress} className="h-3 rounded-full bg-muted shadow-inner" />
							</div>

							<div className="grid grid-cols-1 gap-2">
								{STAGES.map((s, idx) => (
									<div 
										key={s.id}
										className={cn(
											"flex items-center gap-4 p-4 rounded-2xl text-sm transition-all border duration-500",
											idx < currentStageIdx ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 opacity-60" :
											idx === currentStageIdx ? "bg-primary/10 border-primary/30 text-primary font-bold scale-[1.02] shadow-sm" :
											"bg-card border-transparent text-muted-foreground opacity-30"
										)}
									>
										<div className={cn(
											"size-8 rounded-full flex items-center justify-center",
											idx < currentStageIdx ? "bg-emerald-500 text-white" :
											idx === currentStageIdx ? "bg-primary text-primary-foreground animate-pulse" :
											"bg-muted text-muted-foreground"
										)}>
											{idx < currentStageIdx ? (
												<CheckCircle2 className="size-4" />
											) : (
												<s.icon className="size-4" />
											)}
										</div>
										<span className="flex-1">{s.label}</span>
										{idx === currentStageIdx && <Loader2 className="size-4 animate-spin" />}
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
