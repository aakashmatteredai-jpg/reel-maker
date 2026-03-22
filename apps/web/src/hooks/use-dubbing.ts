import { useEditor } from "@/hooks/use-editor";
import { useDubbingStore } from "@/stores/dubbing-store";
import { generateSpeech } from "@/lib/ai/voiceover";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import { buildEmptyTrack } from "@/lib/timeline/track-utils";
import { generateUUID } from "@/utils/id";
import { toast } from "sonner";

export function useDubbing() {
    const editor = useEditor();
    const { characters, segments, setIsDubbing, updateSegment } = useDubbingStore();

    const dubAll = async () => {
        setIsDubbing(true);
        const projectId = editor.project.getActive()?.metadata.id;
        if (!projectId) {
            toast.error("No active project found.");
            setIsDubbing(false);
            return;
        }

        try {
            const results: { segmentIdx: number; file: File; duration: number }[] = [];

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const character = characters.find(c => c.id === segment.speakerId);
                
                if (!character || !character.ttsVoiceId || !character.ttsProvider) {
                    continue;
                }

                toast.loading(`Generating audio for segment ${i + 1}/${segments.length}...`, { id: "dubbing-progress" });

                try {
                    const audioBlob = await generateSpeech(
                        character.ttsProvider,
                        segment.text,
                        character.ttsVoiceId
                    );

                    const file = new File([audioBlob], `dub_${segment.speakerId}_${i}.wav`, { type: "audio/wav" });
                    results.push({
                        segmentIdx: i,
                        file,
                        duration: segment.end - segment.start
                    });
                } catch (err) {
                    console.error(`Failed to dub segment ${i}:`, err);
                }
            }

            if (results.length === 0) {
                toast.error("No audio generated.", { id: "dubbing-progress" });
                setIsDubbing(false);
                return;
            }

            // 3. Batch Add to Media Manager
            const mediaIds = await editor.media.addMediaAssets({
                projectId,
                assets: results.map(r => ({
                    file: r.file,
                    url: URL.createObjectURL(r.file),
                    type: "audio",
                    name: `Dub Segment ${r.segmentIdx}`,
                    duration: r.duration
                }))
            });

            // 4. Batch Add to Timeline
            const tracksBefore = editor.timeline.getTracks();
            const dubbingTrackId = generateUUID();
            const dubbingTrack = buildEmptyTrack({ id: dubbingTrackId, type: "audio" });
            dubbingTrack.name = "Dubbing Layer";

            const elements = results.map((r, batchIdx) => {
                const character = characters.find(c => c.id === segments[r.segmentIdx].speakerId);
                return buildElementFromMedia({
                    mediaId: mediaIds[batchIdx],
                    mediaType: "audio",
                    name: `Dub ${character?.name || "Speaker"}`,
                    duration: r.duration,
                    startTime: segments[r.segmentIdx].start,
                });
            });

            (dubbingTrack as any).elements = elements;

            const tracksAfter = [...tracksBefore, dubbingTrack];
            editor.timeline.updateTracks(tracksAfter);
            editor.timeline.pushTracksSnapshot({ before: tracksBefore, after: tracksAfter });

            results.forEach(r => updateSegment(r.segmentIdx, { isDubbed: true }));

            toast.success("Dubbing complete!", { id: "dubbing-progress" });
        } catch (error) {
            console.error("Dubbing failed:", error);
            toast.error("Dubbing failed. Check console for details.", { id: "dubbing-progress" });
        } finally {
            setIsDubbing(false);
        }
    };

    return { dubAll };
}
