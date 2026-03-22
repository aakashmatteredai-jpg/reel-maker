"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { MediaDragOverlay } from "@/components/editor/panels/assets/drag-overlay";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useEditor } from "@/hooks/use-editor";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRevealItem } from "@/hooks/use-reveal-item";
import { processMediaAssets } from "@/lib/media/processing";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import {
	type MediaSortKey,
	type MediaSortOrder,
	type MediaViewMode,
	useAssetsPanelStore,
} from "@/stores/assets-panel-store";
import type { MediaAsset } from "@/types/assets";
import { cn } from "@/utils/ui";
import {
	CloudUploadIcon,
	GridViewIcon,
	LeftToRightListDashIcon,
	SortingOneNineIcon,
	Image02Icon,
	MusicNote03Icon,
	Video01Icon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export function MediaView() {
	const editor = useEditor();
	const mediaFiles = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const {
		mediaViewMode,
		setMediaViewMode,
		highlightMediaId,
		clearHighlight,
		mediaSortBy,
		mediaSortOrder,
		setMediaSort,
	} = useAssetsPanelStore();
	const { highlightedId, registerElement } = useRevealItem(
		highlightMediaId,
		clearHighlight,
	);

	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isSelectionMode, setIsSelectionMode] = useState(false);

	const processFiles = async ({ files }: { files: FileList }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			const processedAssets = await processMediaAssets({
				files,
				onProgress: (progress: { progress: number }) =>
					setProgress(progress.progress),
			});
			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
		} catch (error) {
			console.error("Error processing files:", error);
			toast.error("Failed to process files");
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const { isDragOver, dragProps, openFilePicker, fileInputProps } =
		useFileUpload({
			accept: "image/*,video/*,audio/*",
			multiple: true,
			onFilesSelected: (files) => processFiles({ files }),
		});

	const handleRemove = async ({
		event,
		id,
	}: {
		event: React.MouseEvent;
		id: string;
	}) => {
		event.stopPropagation();

		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		await editor.media.removeMediaAsset({
			projectId: activeProject.metadata.id,
			id,
		});

		setSelectedIds(prev => {
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
	};

	const handleBulkRemove = async () => {
		if (!activeProject || selectedIds.size === 0) return;

		const ids = Array.from(selectedIds);
		const count = ids.length;

		// We should probably have a bulk remove in MediaManager, but for now we loop
		for (const id of ids) {
			await editor.media.removeMediaAsset({
				projectId: activeProject.metadata.id,
				id,
			});
		}

		setSelectedIds(new Set());
		setIsSelectionMode(false);
		toast.success(`Removed ${count} assets`);
	};

	const toggleSelection = (id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleSort = ({ key }: { key: MediaSortKey }) => {
		if (mediaSortBy === key) {
			setMediaSort(key, mediaSortOrder === "asc" ? "desc" : "asc");
		} else {
			setMediaSort(key, "asc");
		}
	};

	const filteredMediaItems = useMemo(() => {
		const filtered = mediaFiles.filter((item) => !item.ephemeral);

		filtered.sort((a, b) => {
			let valueA: string | number;
			let valueB: string | number;

			switch (mediaSortBy) {
				case "name":
					valueA = a.name.toLowerCase();
					valueB = b.name.toLowerCase();
					break;
				case "type":
					valueA = a.type;
					valueB = b.type;
					break;
				case "duration":
					valueA = a.duration || 0;
					valueB = b.duration || 0;
					break;
				case "size":
					valueA = a.file.size;
					valueB = b.file.size;
					break;
				default:
					return 0;
			}

			if (valueA < valueB) return mediaSortOrder === "asc" ? -1 : 1;
			if (valueA > valueB) return mediaSortOrder === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [mediaFiles, mediaSortBy, mediaSortOrder]);

	return (
		<>
			<input {...fileInputProps} />

			<PanelView
				title="Assets"
				actions={
					<MediaActions
						mediaViewMode={mediaViewMode}
						setMediaViewMode={setMediaViewMode}
						isProcessing={isProcessing}
						sortBy={mediaSortBy}
						sortOrder={mediaSortOrder}
						onSort={handleSort}
						onImport={openFilePicker}
						selectedCount={selectedIds.size}
						onBulkRemove={handleBulkRemove}
						isSelectionMode={isSelectionMode}
						setIsSelectionMode={setIsSelectionMode}
						onClearSelection={() => setSelectedIds(new Set())}
					/>
				}
				className={cn(isDragOver && "bg-accent/30")}
				{...dragProps}
			>
				{isDragOver || filteredMediaItems.length === 0 ? (
					<MediaDragOverlay
						isVisible={true}
						isProcessing={isProcessing}
						progress={progress}
						onClick={openFilePicker}
					/>
				) : (
					<MediaItemList
						items={filteredMediaItems}
						mode={mediaViewMode}
						onRemove={handleRemove}
						highlightedId={highlightedId}
						registerElement={registerElement}
						selectedIds={selectedIds}
						onToggleSelection={toggleSelection}
						isSelectionMode={isSelectionMode}
					/>
				)}
			</PanelView>
		</>
	);
}

function MediaAssetDraggable({
	item,
	preview,
	isHighlighted,
	variant,
	isRounded,
	isSelected = false,
	onClick,
}: {
	item: MediaAsset;
	preview: React.ReactNode;
	isHighlighted: boolean;
	variant: "card" | "compact";
	isRounded?: boolean;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
}) {
	const editor = useEditor();

	const addElementAtTime = ({
		asset,
		startTime,
	}: {
		asset: MediaAsset;
		startTime: number;
	}) => {
		const duration =
			asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		const element = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: asset.type,
			name: asset.name,
			duration,
			startTime,
		});
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	return (
		<DraggableItem
			name={item.name}
			preview={preview}
			dragData={{
				id: item.id,
				type: "media",
				mediaType: item.type,
				name: item.name,
				...(item.type !== "audio" && {
					targetElementTypes: ["video", "image"] as const,
				}),
			}}
			shouldShowPlusOnDrag={false}
			onAddToTimeline={({ currentTime }) =>
				addElementAtTime({ asset: item, startTime: currentTime })
			}
			variant={variant}
			isRounded={isRounded}
			isHighlighted={isHighlighted}
			isSelected={isSelected}
			onClick={onClick}
		/>
	);
}

function MediaItemWithContextMenu({
	item,
	children,
	onRemove,
}: {
	item: MediaAsset;
	children: React.ReactNode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem>Export clips</ContextMenuItem>
				<ContextMenuItem
					variant="destructive"
					onClick={(event) => onRemove({ event, id: item.id })}
				>
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function MediaItemList({
	items,
	mode,
	onRemove,
	highlightedId,
	registerElement,
	selectedIds,
	onToggleSelection,
	isSelectionMode,
}: {
	items: MediaAsset[];
	mode: MediaViewMode;
	onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
	highlightedId: string | null;
	registerElement: (id: string, element: HTMLElement | null) => void;
	selectedIds: Set<string>;
	onToggleSelection: (id: string) => void;
	isSelectionMode: boolean;
}) {
	const isGrid = mode === "grid";

	return (
		<div
			className={cn(isGrid ? "grid gap-2" : "flex flex-col gap-1")}
			style={
				isGrid ? { gridTemplateColumns: "repeat(auto-fill, 160px)" } : undefined
			}
		>
			{items.map((item) => (
				<div key={item.id} ref={(element) => registerElement(item.id, element)}>
					<MediaItemWithContextMenu item={item} onRemove={onRemove}>
						<MediaAssetDraggable
							item={item}
							preview={
								<MediaPreview
									item={item}
									variant={isGrid ? "grid" : "compact"}
								/>
							}
							variant={isGrid ? "card" : "compact"}
							isRounded={isGrid ? false : undefined}
							isHighlighted={highlightedId === item.id}
							isSelected={selectedIds.has(item.id)}
							onClick={(e) => {
								if (isSelectionMode || e.metaKey || e.ctrlKey || e.shiftKey) {
									e.preventDefault();
									e.stopPropagation();
									onToggleSelection(item.id);
								}
							}}
						/>
					</MediaItemWithContextMenu>
				</div>
			))}
		</div>
	);
}

export function formatDuration({ duration }: { duration: number }) {
	const min = Math.floor(duration / 60);
	const sec = Math.floor(duration % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function MediaDurationBadge({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
			{formatDuration({ duration })}
		</div>
	);
}

function MediaDurationLabel({ duration }: { duration?: number }) {
	if (!duration) return null;

	return (
		<span className="text-xs opacity-70">{formatDuration({ duration })}</span>
	);
}

function MediaTypePlaceholder({
	icon,
	label,
	duration,
	variant,
}: {
	icon: IconSvgElement;
	label: string;
	duration?: number;
	variant: "muted" | "bordered";
}) {
	const iconClassName = cn("size-6", variant === "bordered" && "mb-1");

	return (
		<div
			className={cn(
				"text-muted-foreground flex size-full flex-col items-center justify-center rounded",
				variant === "muted" ? "bg-muted/30" : "border",
			)}
		>
			<HugeiconsIcon icon={icon} className={iconClassName} />
			<span className="text-xs">{label}</span>
			<MediaDurationLabel duration={duration} />
		</div>
	);
}

function MediaPreview({
	item,
	variant = "grid",
}: {
	item: MediaAsset;
	variant?: "grid" | "compact";
}) {
	const shouldShowDurationBadge = variant === "grid";

	if (item.type === "image") {
		return (
			<div className="relative flex size-full items-center justify-center">
				<Image
					src={item.url ?? ""}
					alt={item.name}
					fill
					sizes="100vw"
					className="object-cover"
					loading="lazy"
					unoptimized
				/>
			</div>
		);
	}

	if (item.type === "video") {
		if (item.thumbnailUrl) {
			return (
				<div className="relative size-full">
					<Image
						src={item.thumbnailUrl}
						alt={item.name}
						fill
						sizes="100vw"
						className="rounded object-cover"
						loading="lazy"
						unoptimized
					/>
					{shouldShowDurationBadge ? (
						<MediaDurationBadge duration={item.duration} />
					) : null}
				</div>
			);
		}

		return (
			<MediaTypePlaceholder
				icon={Video01Icon}
				label="Video"
				duration={item.duration}
				variant="muted"
			/>
		);
	}

	if (item.type === "audio") {
		return (
			<MediaTypePlaceholder
				icon={MusicNote03Icon}
				label="Audio"
				duration={item.duration}
				variant="bordered"
			/>
		);
	}

	return (
		<MediaTypePlaceholder icon={Image02Icon} label="Unknown" variant="muted" />
	);
}

function MediaActions({
	mediaViewMode,
	setMediaViewMode,
	isProcessing,
	sortBy,
	sortOrder,
	onSort,
	onImport,
	selectedCount,
	onBulkRemove,
	isSelectionMode,
	setIsSelectionMode,
	onClearSelection,
}: {
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	isProcessing: boolean;
	sortBy: MediaSortKey;
	sortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
	onImport: () => void;
	selectedCount: number;
	onBulkRemove: () => void;
	isSelectionMode: boolean;
	setIsSelectionMode: (mode: boolean) => void;
	onClearSelection: () => void;
}) {
	return (
		<div className="flex gap-1.5 items-center">
			{selectedCount > 0 ? (
				<div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
					<span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
						{selectedCount} selected
					</span>
					
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
									onClick={onBulkRemove}
								>
									<HugeiconsIcon icon={Delete02Icon} className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Delete selected</TooltipContent>
						</Tooltip>
						
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									size="sm"
									variant="ghost"
									className="h-8 text-[10px] uppercase tracking-wider font-bold"
									onClick={onClearSelection}
								>
									Clear
								</Button>
							</TooltipTrigger>
							<TooltipContent>Clear selection</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<div className="w-[1px] h-4 bg-border mx-1" />
				</div>
			) : (
				<Button
					size="sm"
					variant={isSelectionMode ? "secondary" : "ghost"}
					className={cn(
						"h-8 text-[10px] uppercase tracking-wider font-bold transition-all",
						isSelectionMode ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground"
					)}
					onClick={() => {
						setIsSelectionMode(!isSelectionMode);
						if (isSelectionMode) onClearSelection();
					}}
				>
					{isSelectionMode ? "Cancel Select" : "Select"}
				</Button>
			)}

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							onClick={() =>
								setMediaViewMode(mediaViewMode === "grid" ? "list" : "grid")
							}
							disabled={isProcessing}
							className="size-8"
						>
							{mediaViewMode === "grid" ? (
								<HugeiconsIcon icon={LeftToRightListDashIcon} className="size-4" />
							) : (
								<HugeiconsIcon icon={GridViewIcon} className="size-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>
							{mediaViewMode === "grid"
								? "Switch to list view"
								: "Switch to grid view"}
						</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<DropdownMenu>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									disabled={isProcessing}
									className="size-8"
								>
									<HugeiconsIcon icon={SortingOneNineIcon} className="size-4" />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<DropdownMenuContent align="end">
							<SortMenuItem
								label="Name"
								sortKey="name"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Type"
								sortKey="type"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="Duration"
								sortKey="duration"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
							<SortMenuItem
								label="File size"
								sortKey="size"
								currentSortBy={sortBy}
								currentSortOrder={sortOrder}
								onSort={onSort}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<TooltipContent>
						<p>
							Sort by {sortBy} (
							{sortOrder === "asc" ? "ascending" : "descending"})
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<Button
				variant="outline"
				onClick={onImport}
				disabled={isProcessing}
				size="sm"
				className="h-8 gap-1.5 px-3"
			>
				<HugeiconsIcon icon={CloudUploadIcon} className="size-4" />
				Import
			</Button>
		</div>
	);
}

function SortMenuItem({
	label,
	sortKey,
	currentSortBy,
	currentSortOrder,
	onSort,
}: {
	label: string;
	sortKey: MediaSortKey;
	currentSortBy: MediaSortKey;
	currentSortOrder: MediaSortOrder;
	onSort: ({ key }: { key: MediaSortKey }) => void;
}) {
	const isActive = currentSortBy === sortKey;
	const arrow = isActive ? (currentSortOrder === "asc" ? "↑" : "↓") : "";

	return (
		<DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
			{label} {arrow}
		</DropdownMenuItem>
	);
}
