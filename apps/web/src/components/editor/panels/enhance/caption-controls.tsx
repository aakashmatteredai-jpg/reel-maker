import { useCaptionStore } from "@/stores/caption-store";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FONT_FAMILIES } from "@/constants/font-constants";

export function CaptionControls() {
	const { enabled, style, useEmojis, setEnabled, setStyle, setUseEmojis } =
		useCaptionStore();

	return (
		<div className="flex flex-col gap-4 p-4">
			<Card>
				<CardHeader className="p-4 pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Enable Captions</CardTitle>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</div>
				</CardHeader>
				{enabled && (
					<CardContent className="p-4 pt-0 flex flex-col gap-4">
						<div className="flex items-center justify-between mt-2">
							<Label className="text-sm">Use AI Emojis</Label>
							<Switch checked={useEmojis} onCheckedChange={setUseEmojis} />
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Font</Label>
							<Select
								value={style.fontFamily}
								onValueChange={(val) => setStyle({ fontFamily: val })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select font" />
								</SelectTrigger>
								<SelectContent>
									{FONT_FAMILIES.map((font) => (
										<SelectItem key={font.id} value={font.name}>
											<span style={{ fontFamily: font.name }}>{font.name}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-2 relative">
							<div className="flex justify-between">
								<Label className="text-xs text-muted-foreground">Size</Label>
								<span className="text-xs text-muted-foreground">{style.fontSize}px</span>
							</div>
							<Slider
								value={[style.fontSize]}
								min={16}
								max={72}
								step={1}
								onValueChange={([val]) => setStyle({ fontSize: val })}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Color</Label>
							<div className="flex gap-2">
								<Input
									type="color"
									value={style.color}
									onChange={(e) => setStyle({ color: e.target.value })}
									className="w-12 h-8 p-1"
								/>
								<Input
									type="text"
									value={style.color}
									onChange={(e) => setStyle({ color: e.target.value })}
									className="flex-1 h-8"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<Label className="text-xs text-muted-foreground">Background</Label>
							<div className="flex gap-2">
								<Input
									type="color"
									value={style.backgroundColor === "transparent" ? "#000000" : style.backgroundColor}
									onChange={(e) => setStyle({ backgroundColor: e.target.value })}
									className="w-12 h-8 p-1"
								/>
								<Select
									value={style.backgroundColor === "transparent" ? "transparent" : "solid"}
									onValueChange={(val) => {
										if (val === "transparent") setStyle({ backgroundColor: "transparent" });
										else setStyle({ backgroundColor: "#000000" });
									}}
								>
									<SelectTrigger className="flex-1 h-8">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="transparent">Transparent</SelectItem>
										<SelectItem value="solid">Solid Color</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<div className="flex justify-between">
								<Label className="text-xs text-muted-foreground">Vertical Position</Label>
								<span className="text-xs text-muted-foreground">{style.positionY}%</span>
							</div>
							<Slider
								value={[style.positionY]}
								min={10}
								max={90}
								step={1}
								onValueChange={([val]) => setStyle({ positionY: val })}
							/>
						</div>
					</CardContent>
				)}
			</Card>
		</div>
	);
}
