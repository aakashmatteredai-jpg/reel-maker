import { create } from "zustand";

export interface CaptionStyle {
	fontFamily: string;
	fontSize: number;
	color: string;
	backgroundColor: string;
	positionY: number;
}

export interface CaptionStore {
	enabled: boolean;
	style: CaptionStyle;
	useEmojis: boolean;
	setEnabled: (enabled: boolean) => void;
	setStyle: (style: Partial<CaptionStyle>) => void;
	setUseEmojis: (use: boolean) => void;
}

export const useCaptionStore = create<CaptionStore>()((set) => ({
	enabled: true,
	style: {
		fontFamily: "Inter",
		fontSize: 32,
		color: "#ffffff",
		backgroundColor: "transparent",
		positionY: 80, // Percentage from top
	},
	useEmojis: true,
	setEnabled: (enabled) => set({ enabled }),
	setStyle: (style) => set((state) => ({ style: { ...state.style, ...style } })),
	setUseEmojis: (useEmojis) => set({ useEmojis }),
}));
