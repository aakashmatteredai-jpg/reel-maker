import { useEditor } from "@/hooks/use-editor";
import { useDubbingStore } from "@/stores/dubbing-store";
import { generateSpeech } from "@/lib/ai/voiceover";
import { generateUUID } from "@/utils/id";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
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
            // 1. Create a "Dubbing" track if it doesn't exist
            let dubbingTrack = editor.timeline.getTracks().find(t => t.name === "Dubbing" && t.type === "audio");
            let trackId = dubbingTrack?.id;
            
            if (!trackId) {
                trackId = editor.timeline.addTrack({ type: "audio" });
                // We could rename it here if needed, but for now we'll just use it
            }

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const character = characters.find(c => c.id === segment.speakerId);
                
                if (!character || !character.ttsVoiceId || !character.ttsProvider) {
                    continue;
                }

                toast.loading(`Generating audio for segment ${i + 1}/${segments.length}...`, { id: "dubbing-progress" });

                try {
                    // 2. Generate TTS
                    const audioBlob = await generateSpeech(
                        character.ttsProvider,
                        segment.text,
                        character.ttsVoiceId
                    );

                    // 3. Add to Media Manager (Let it generate the ID)
                    const file = new File([audioBlob], `dub_${segment.speakerId}_${i}.wav`, { type: "audio/wav" });
                    const url = URL.createObjectURL(file);

                    const mediaId = await editor.media.addMediaAsset({
                        projectId,
                        asset: {
                            file,
                            url,
                            type: "audio",
                            name: `Dub ${character.name} ${i}`,
                            duration: segment.end - segment.start,
                        }
                    });

                    if (mediaId) {
                        // 4. Insert into Timeline
                        const duration = segment.end - segment.start;
                        const element = buildElementFromMedia({
                            mediaId,
                            mediaType: "audio",
                            name: `Dub ${character.name}`,
                            duration,
                            startTime: segment.start,
                        });

                        editor.timeline.insertElement({
                            element,
                            placement: {
                                mode: "explicit",
                                trackId: trackId as string,
                            }
                        });
                        updateSegment(i, { isDubbed: true });
                    }
                } catch (err) {
                    console.error(`Failed to dub segment ${i}:`, err);
                    toast.error(`Segment ${i + 1} failed.`, { id: "dubbing-progress" });
                }
            }

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
