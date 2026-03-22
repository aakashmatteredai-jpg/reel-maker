import { FontPicker } from "@/components/ui/font-picker";
import type { TranscriptElement } from "@/types/timeline";
import { NumberField } from "@/components/ui/number-field";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "./section";
import { ColorPicker } from "@/components/ui/color-picker";
import { uppercase } from "@/utils/string";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import {
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "@/constants/text-constants";
import { usePropertyDraft } from "./hooks/use-property-draft";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	TextFontIcon,
	ViewIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

export function TranscriptProperties({
	element,
	trackId,
}: {
	element: TranscriptElement;
	trackId: string;
}) {
	return (
		<div className="flex h-full flex-col">
			<TypographySection element={element} trackId={trackId} />
			<PositionSection element={element} trackId={trackId} />
			<BackgroundSection element={element} trackId={trackId} />
		</div>
	);
}

function TypographySection({
	element,
	trackId,
}: {
	element: TranscriptElement;
	trackId: string;
}) {
	const editor = useEditor();

	const fontSize = usePropertyDraft({
		displayValue: element.fontSize.toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { fontSize: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="transcript:typography" showTopBorder={false}>
			<SectionHeader>
				<SectionTitle>Typography</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					<SectionField label="Font">
						<FontPicker
							defaultValue={element.fontFamily}
							onValueChange={(value) =>
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { fontFamily: value },
										},
									],
								})
							}
						/>
					</SectionField>
					<SectionField label="Size">
						<NumberField
							value={fontSize.displayValue}
							min={MIN_FONT_SIZE}
							max={MAX_FONT_SIZE}
							onFocus={fontSize.onFocus}
							onChange={fontSize.onChange}
							onBlur={fontSize.onBlur}
							onScrub={fontSize.scrubTo}
							onScrubEnd={fontSize.commitScrub}
							icon={<HugeiconsIcon icon={TextFontIcon} />}
						/>
					</SectionField>
					<SectionField label="Color">
						<ColorPicker
							value={uppercase({
								string: element.color.replace("#", ""),
							})}
							onChange={(color) => 
								editor.timeline.updateElements({
									updates: [
										{
											trackId,
											elementId: element.id,
											updates: { color: `#${color}` },
										},
									],
								})
							}
						/>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

function PositionSection({
	element,
	trackId,
}: {
	element: TranscriptElement;
	trackId: string;
}) {
	const editor = useEditor();

	const positionY = usePropertyDraft({
		displayValue: element.positionY.toString(),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clamp({ value: parsed, min: 0, max: 100 });
		},
		onPreview: (value) =>
			editor.timeline.previewElements({
				updates: [
					{ trackId, elementId: element.id, updates: { positionY: value } },
				],
			}),
		onCommit: () => editor.timeline.commitPreview(),
	});

	return (
		<Section collapsible sectionKey="transcript:position">
			<SectionHeader>
				<SectionTitle>Position</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionField label="Vertical (%)">
					<NumberField
						value={positionY.displayValue}
						min={0}
						max={100}
						onFocus={positionY.onFocus}
						onChange={positionY.onChange}
						onBlur={positionY.onBlur}
						onScrub={positionY.scrubTo}
						onScrubEnd={positionY.commitScrub}
					/>
				</SectionField>
			</SectionContent>
		</Section>
	);
}

function BackgroundSection({
	element,
	trackId,
}: {
	element: TranscriptElement;
	trackId: string;
}) {
	const editor = useEditor();

	const toggleBackgroundEnabled = () => {
		const isVisible = element.backgroundColor !== "transparent";
		const color = isVisible ? "transparent" : "#000000";
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { backgroundColor: color },
				},
			],
		});
	};

	return (
		<Section collapsible sectionKey="transcript:background">
			<SectionHeader
				trailing={
					<Button
						variant="ghost"
						size="icon"
						onClick={(event) => {
							event.stopPropagation();
							toggleBackgroundEnabled();
						}}
					>
						<HugeiconsIcon
							icon={element.backgroundColor !== "transparent" ? ViewIcon : ViewOffSlashIcon}
						/>
					</Button>
				}
			>
				<SectionTitle>Background</SectionTitle>
			</SectionHeader>
			<SectionContent
				className={cn(
					element.backgroundColor === "transparent" && "pointer-events-none opacity-50",
				)}
			>
				<SectionField label="Color">
					<ColorPicker
						value={uppercase({
							string: element.backgroundColor === "transparent" ? "000000" : element.backgroundColor.replace("#", ""),
						})}
						onChange={(color) => 
							editor.timeline.updateElements({
								updates: [
									{
										trackId,
										elementId: element.id,
										updates: { backgroundColor: `#${color}` },
									},
								],
							})
						}
					/>
				</SectionField>
			</SectionContent>
		</Section>
	);
}
