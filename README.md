AutoCaptionAI — End-to-end project bundle

Files:
- extension/: Chrome extension files (load unpacked in chrome://extensions)
- server/: FastAPI server using Whisper + WhisperX for word-level timestamps

Quickstart (local dev):
1. Server:
   - cd server
   - pip install -r requirements.txt
   - ensure ffmpeg is installed
   - python server_whisperx.py
2. Extension:
   - open chrome://extensions
   - enable Developer mode
   - Load unpacked extension -> select extension/ directory
   - Configure backend wss URL in popup (for local, use ws://localhost:8000/ws)
