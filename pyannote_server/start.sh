#!/bin/bash
cd "$(dirname "$0")"
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
