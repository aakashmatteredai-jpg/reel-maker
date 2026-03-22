import type { EditorCore } from "@/core";
import type { MediaAsset } from "@/types/assets";
import { storageService } from "@/services/storage/service";
import { generateUUID } from "@/utils/id";
import { videoCache } from "@/services/video-cache/service";
import { hasMediaId } from "@/lib/timeline/element-utils";
import { MAX_FILE_SIZE_BYTES, MAX_VIDEO_DURATION_SECONDS } from "@/constants/reel-constants";
import { toast } from "sonner";

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
	}): Promise<string | undefined> {
		if (asset.file.size > MAX_FILE_SIZE_BYTES) {
			toast.error(`File too large`, {
				description: `File size must be less than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
			});
			return;
		}

		if (asset.type === "video" && asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS) {
			toast.error(`Video too long`, {
				description: `Video duration must be less than ${MAX_VIDEO_DURATION_SECONDS} seconds.`,
			});
			return;
		}
		const newAsset: MediaAsset = {
			...asset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			return newAsset.id;
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
			this.notify();
			return undefined;
		}
	}

	async addMediaAssets({
		projectId,
		assets,
	}: {
		projectId: string;
		assets: Omit<MediaAsset, "id">[];
	}): Promise<string[]> {
		const newAssets: MediaAsset[] = assets.map(asset => ({
			...asset,
			id: generateUUID(),
		}));

		this.assets = [...this.assets, ...newAssets];
		this.notify();

		try {
			await Promise.all(
				newAssets.map(asset => storageService.saveMediaAsset({ projectId, mediaAsset: asset }))
			);
			return newAssets.map(a => a.id);
		} catch (error) {
			console.error("Failed to save some media assets:", error);
			return newAssets.map(a => a.id);
		}
	}

	async removeMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((asset) => asset.id === id);

		videoCache.clearVideo({ mediaId: id });

		if (asset?.url) {
			URL.revokeObjectURL(asset.url);
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		}

		this.assets = this.assets.filter((asset) => asset.id !== id);
		this.notify();

		const tracks = this.editor.timeline.getTracks();
		const elementsToRemove: Array<{ trackId: string; elementId: string }> = [];

		for (const track of tracks) {
			for (const element of track.elements) {
				if (hasMediaId(element) && element.mediaId === id) {
					elementsToRemove.push({ trackId: track.id, elementId: element.id });
				}
			}
		}

		if (elementsToRemove.length > 0) {
			this.editor.timeline.deleteElements({ elements: elementsToRemove });
		}

		try {
			await storageService.deleteMediaAsset({ projectId, id });
		} catch (error) {
			console.error("Failed to delete media asset:", error);
		}
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;
			this.notify();
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
