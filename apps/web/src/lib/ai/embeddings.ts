import { pipeline } from "@huggingface/transformers";

let extractor: any = null;

/**
 * Loads the feature extraction model for voice embeddings.
 */
async function getExtractor() {
	if (extractor) return extractor;
	
	// 'facebook/wav2vec2-base-960h' or specialized speaker models
	// For client-side, we want a lightweight one.
	extractor = await pipeline("feature-extraction", "Xenova/wav2vec2-base-960h", {
		dtype: "q8",
	});
	return extractor;
}

/**
 * Generates an embedding vector for a given audio Blob.
 */
export async function generateVoiceEmbedding(audioBlob: Blob): Promise<number[]> {
	const extractor = await getExtractor();
	
	// Convert Blob to Float32Array (required by transformers.js)
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
	const float32Data = audioBuffer.getChannelData(0); // Mono channel 0

	// Extract features
	const output = await extractor(float32Data, { pooling: "mean" });
	
	// Return the embedding as a flat array
	return Array.from(output.data);
}

/**
 * Calculates cosine similarity between two embedding vectors.
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
	let dotProduct = 0;
	let mag1 = 0;
	let mag2 = 0;
	for (let i = 0; i < v1.length; i++) {
		dotProduct += v1[i] * v2[i];
		mag1 += v1[i] * v1[i];
		mag2 += v2[i] * v2[i];
	}
	return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}
