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
        # Run the standard pipeline
        # Note: We don't specify num_speakers because we want it to be automatic
        diarization = pipeline(tmp_path)
        
        segments = []
        raw_speakers = set()

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            raw_speakers.add(speaker)
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 3),
                "end": round(turn.end, 3)
            })

        # Return the results
        # Sorting and renaming is now handled by the frontend for better flexibility
        return {
            "speakers": list(raw_speakers),
            "segments": segments
        }
    except Exception as e:
        print(f"Diarization error: {e}")
        return {"speakers": [], "segments": [], "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
