#!/bin/bash
cd "$(dirname "$0")"
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
