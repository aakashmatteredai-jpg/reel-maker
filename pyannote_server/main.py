from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import torch
from pyannote.audio import Pipeline
import tempfile, os, json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=os.environ.get("HF_TOKEN")
)

if torch.cuda.is_available():
    pipeline = pipeline.to(torch.device("cuda"))

@app.post("/diarize")
async def diarize(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        diarization = pipeline(tmp_path)
        segments = []
        seen_speakers = set()

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            seen_speakers.add(speaker)
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 3),
                "end": round(turn.end, 3)
            })

        return {
            "speakers": list(seen_speakers),
            "segments": segments
        }
    finally:
        os.unlink(tmp_path)
