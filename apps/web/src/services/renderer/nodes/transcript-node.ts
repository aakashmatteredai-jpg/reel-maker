import { BaseNode } from "./base-node";
import type { TranscriptElement } from "@/types/timeline";
import type { TranscriptionResult } from "@/types/transcription";
import type { CanvasRenderer } from "../canvas-renderer";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import { injectEmojis } from "@/lib/transcription/emoji-map";
import { FONT_SIZE_SCALE_REFERENCE } from "@/constants/text-constants";

export interface TranscriptNodeParams extends TranscriptElement {
	transcript: TranscriptionResult;
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
}

export class TranscriptNode extends BaseNode<TranscriptNodeParams> {
	private chunks: ReturnType<typeof buildCaptionChunks>;

	constructor(params: TranscriptNodeParams) {
		super(params);
		this.chunks = buildCaptionChunks({ segments: params.transcript.segments });
	}

	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) {
			return;
		}

		const activeChunk = this.chunks.find(
			(chunk) =>
				time >= chunk.startTime &&
				time <= chunk.startTime + chunk.duration
		);

		if (!activeChunk) return;

		const textToDisplay = injectEmojis(activeChunk.text);
		const ctx = renderer.context;
		
		const scaledFontSize = this.params.fontSize * (this.params.canvasHeight / FONT_SIZE_SCALE_REFERENCE);
		const fontWeight = "bold";
		const fontFamily = `"${this.params.fontFamily.replace(/"/g, '\\"')}", sans-serif`;
		
		ctx.save();
		ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		
		const x = this.params.canvasCenter.x;
		const y = (this.params.positionY / 100) * this.params.canvasHeight;

		const lines = textToDisplay.replace(/\\n/g, "\n").split("\n");
		const lineHeight = scaledFontSize * 1.2;
		const blockHeight = lines.length * lineHeight;
		
		// Draw background if not transparent
		if (this.params.backgroundColor !== "transparent") {
			let maxWidth = 0;
			for (const line of lines) {
				maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
			}
			
			const paddingX = scaledFontSize * 0.5;
			const paddingY = scaledFontSize * 0.2;
			const bgWidth = maxWidth + paddingX * 2;
			const bgHeight = blockHeight + paddingY * 2;
			
			ctx.fillStyle = this.params.backgroundColor;
			ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
		} else {
			// Shadow for readability if no background
			ctx.shadowColor = "#000000";
			ctx.shadowBlur = 4;
			ctx.shadowOffsetX = 2;
			ctx.shadowOffsetY = 2;
		}

		ctx.fillStyle = this.params.color;
		for (let i = 0; i < lines.length; i++) {
			const lineY = y - (blockHeight / 2) + (i * lineHeight) + (lineHeight / 2);
			ctx.fillText(lines[i], x, lineY);
		}
		
		ctx.restore();
	}
}
