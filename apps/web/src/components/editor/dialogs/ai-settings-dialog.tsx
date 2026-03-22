import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getStoredKeys, saveKeys } from "@/lib/ai/ai-config";
import { toast } from "sonner";

interface AISettingsDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({ isOpen, onOpenChange }: AISettingsDialogProps) {
	const [keys, setKeys] = useState<{
		openai: string;
		gemini: string;
		groq: string;
		elevenlabs: string;
		sarvam: string;
	}>({
		openai: "",
		gemini: "",
		groq: "",
		elevenlabs: "",
		sarvam: "",
	});

	useEffect(() => {
		if (isOpen) {
			const stored = getStoredKeys();
			setKeys({
				openai: stored.openai || "",
				gemini: stored.gemini || "",
				groq: stored.groq || "",
				elevenlabs: stored.elevenlabs || "",
				sarvam: stored.sarvam || "",
			});
		}
	}, [isOpen]);

	const handleSave = () => {
		saveKeys({
			openai: keys.openai.trim() || undefined,
			gemini: keys.gemini.trim() || undefined,
			groq: keys.groq.trim() || undefined,
			elevenlabs: keys.elevenlabs.trim() || undefined,
			sarvam: keys.sarvam.trim() || undefined,
		});
		toast.success("API Keys saved securely to your browser.");
		onOpenChange(false);
	};

	const handleClear = () => {
		saveKeys({});
		setKeys({ openai: "", gemini: "", groq: "", elevenlabs: "", sarvam: "" });
		toast.success("API Keys cleared.");
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>AI API Settings</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 py-4">
					<p className="text-sm text-muted-foreground">
						Your keys are stored securely in your browser's local storage and are never sent to our servers. They are sent directly to the respective API providers.
					</p>

					<div className="flex flex-col gap-2">
						<Label htmlFor="openai">OpenAI API Key (GPT-4o, etc.)</Label>
						<Input
							id="openai"
							type="password"
							placeholder="sk-..."
							value={keys.openai}
							onChange={(e) => setKeys((prev) => ({ ...prev, openai: e.target.value }))}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="gemini">Google Gemini API Key</Label>
						<Input
							id="gemini"
							type="password"
							placeholder="AIza..."
							value={keys.gemini}
							onChange={(e) => setKeys((prev) => ({ ...prev, gemini: e.target.value }))}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="groq">Groq API Key (Fastest)</Label>
						<Input
							id="groq"
							type="password"
							placeholder="gsk_..."
							value={keys.groq}
							onChange={(e) => setKeys((prev) => ({ ...prev, groq: e.target.value }))}
						/>
					</div>

					<div className="flex flex-col gap-2 mt-2 pt-2 border-t">
						<Label htmlFor="elevenlabs">ElevenLabs API Key (HQ Voiceover)</Label>
						<Input
							id="elevenlabs"
							type="password"
							placeholder="..."
							value={keys.elevenlabs}
							onChange={(e) => setKeys((prev) => ({ ...prev, elevenlabs: e.target.value }))}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="sarvam">Sarvam API Key (Indic Voiceover)</Label>
						<Input
							id="sarvam"
							type="password"
							placeholder="..."
							value={keys.sarvam}
							onChange={(e) => setKeys((prev) => ({ ...prev, sarvam: e.target.value }))}
						/>
					</div>
				</div>
				<div className="flex justify-between items-center">
					<Button variant="outline" onClick={handleClear} className="text-destructive">
						Clear All
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave}>Save Keys</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
