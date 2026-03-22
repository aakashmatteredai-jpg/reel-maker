export async function chunkAudioFile(file: File | Blob, chunkDurationSeconds: number): Promise<Blob[]> {
  // 1. Read file as an ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 2. Decode the audio data
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const chunks: Blob[] = [];
  const sampleRate = audioBuffer.sampleRate;
  const totalLength = audioBuffer.length;
  const chunkLength = Math.floor(sampleRate * chunkDurationSeconds);

  for (let start = 0; start < totalLength; start += chunkLength) {
    const end = Math.min(start + chunkLength, totalLength);
    const length = end - start;

    // Create a new AudioBuffer for the chunk
    const chunkBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      length,
      sampleRate
    );

    // Copy data for each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const chunkData = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        chunkData[i] = channelData[start + i];
      }
      chunkBuffer.copyToChannel(chunkData, channel, 0);
    }

    // Convert chunk AudioBuffer to WAV Blob
    const wavBlob = audioBufferToWav(chunkBuffer);
    chunks.push(wavBlob);
  }

  // Close context to free up memory
  if (ctx.state !== "closed") {
    await ctx.close().catch(() => {});
  }

  return chunks;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const result = new Float32Array(buffer.length * numChannels);

  // Interleave channels
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      result[i * numChannels + channel] = channelData[i];
    }
  }

  const output = new DataView(new ArrayBuffer(44 + result.length * 2));
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(output, 0, 'RIFF');
  output.setUint32(4, 36 + result.length * 2, true);
  writeString(output, 8, 'WAVE');
  writeString(output, 12, 'fmt ');
  output.setUint32(16, 16, true);
  output.setUint16(20, format, true);
  output.setUint16(22, numChannels, true);
  output.setUint32(24, sampleRate, true);
  output.setUint32(28, sampleRate * numChannels * 2, true);
  output.setUint16(32, numChannels * 2, true);
  output.setUint16(34, bitDepth, true);
  writeString(output, 36, 'data');
  output.setUint32(40, result.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < result.length; i++) {
    let s = Math.max(-1, Math.min(1, result[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([output], { type: 'audio/wav' });
}
