# Dub Feature Setup

This project now includes a professional multi-speaker dubbing pipeline using Pyannote for diarization and Sarvam AI for transcription.

### 1. Get a Hugging Face token
- Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- Accept terms for the [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) model.
- Create a token with **read** access.

### 2. Start the Python diarization server
You need to run the local Python server for the "Dub" feature to work.

```bash
export HF_TOKEN=your_hf_token_here
bash pyannote_server/start.sh
```

### 3. Add your Sarvam API key
Create or update `apps/web/.env.local`:

```
NEXT_PUBLIC_SARVAM_API_KEY=your_key_here
PYANNOTE_SERVER_URL=http://localhost:8000
```

### 4. Run the app
```bash
bun dev:web
```

---

## Technical Architecture

- **Diarization**: Python FastAPI server using Pyannote 3.1.
- **Transcription**: Sarvam AI (saarika:v2).
- **Storage**: IndexedDB (via `dub-storage.ts`) for high-performance audio blob handling.
- **Slicing**: Real-time FFmpeg.wasm processing in the browser.
