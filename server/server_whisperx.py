import os, json, tempfile, asyncio, traceback
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import ffmpeg
import whisper
import whisperx

app = FastAPI()

WHISPER_MODEL = os.environ.get('WHISPER_MODEL','small')
DEVICE = 'cuda' if os.environ.get('USE_CUDA','0') == '1' else 'cpu'

print(f'Loading whisper model {WHISPER_MODEL} on {DEVICE}...')
model = whisper.load_model(WHISPER_MODEL, device=DEVICE)

align_model = None
align_metadata = None

def load_whisperx_alignment(lang_code='en'):
  global align_model, align_metadata
  if align_model is None:
    print('Loading whisperx align model...')
    align_model, align_metadata = whisperx.load_align_model(device=DEVICE, model_name='tts')
  return align_model, align_metadata

def webm_bytes_to_wav_path(data_bytes, sample_rate=16000):
  tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.webm')
  tmp_in.write(data_bytes); tmp_in.flush(); tmp_in.close()
  tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.wav'); tmp_out.close()
  try:
    ffmpeg.input(tmp_in.name).output(tmp_out.name, format='wav', acodec='pcm_s16le', ac=1, ar=sample_rate).overwrite_output().run(quiet=True)
    return tmp_out.name
  finally:
    try: os.remove(tmp_in.name)
    except: pass

def transcribe(wav_path, language=None):
  kwargs = {}
  if language:
    kwargs['language'] = language
    kwargs['task'] = 'transcribe'
  result = model.transcribe(wav_path, **kwargs)
  return result

def align_with_whisperx(trans_result, wav_path, language=None):
  load_whisperx_alignment(language or 'en')
  aligned = whisperx.align(trans_result['segments'], align_model, align_metadata, wav_path, DEVICE)
  word_segments = aligned.get('word_segments', [])
  words = []
  for w in word_segments:
    wt = w.get('word','').strip()
    if not wt: continue
    words.append({'word': wt, 'start': float(w.get('start',0.0)), 'end': float(w.get('end',0.0)), 'confidence': float(w.get('score',0.0)) if w.get('score') else None})
  return words

async def process_chunk_and_respond(ws, audio_bytes, video_time, language=None, translate_target=None):
  wav_path = None
  try:
    wav_path = webm_bytes_to_wav_path(audio_bytes)
    trans_result = transcribe(wav_path, language)
    word_segments = align_with_whisperx(trans_result, wav_path, language)
    absolute = []
    for w in word_segments:
      absolute.append({'word': w['word'], 'start': video_time + w['start'], 'end': video_time + w['end'], 'confidence': w.get('confidence')})
    payload = {'type':'word_timestamps','chunk_start_time': video_time,'words': absolute}
    await ws.send_text(json.dumps(payload))
  except Exception as e:
    print('processing error', e); traceback.print_exc()
    try: await ws.send_text(json.dumps({'type':'error','error':'processing_failed','detail':str(e)}))
    except: pass
  finally:
    try:
      if wav_path and os.path.exists(wav_path): os.remove(wav_path)
    except: pass

@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
  await ws.accept()
  try:
    while True:
      msg = await ws.receive()
      if 'text' in msg and msg['text'] is not None:
        try:
          meta = json.loads(msg['text'])
        except:
          await ws.send_text(json.dumps({'type':'error','error':'invalid_meta'})); continue
        if meta.get('type') != 'meta' or 'video_time' not in meta:
          await ws.send_text(json.dumps({'type':'error','error':'expected_meta'})); continue
        video_time = float(meta['video_time'])
        language = meta.get('language')
        # receive binary next
        bin_msg = await ws.receive()
        if 'bytes' not in bin_msg:
          await ws.send_text(json.dumps({'type':'error','error':'expected_binary_after_meta'})); continue
        audio_bytes = bin_msg['bytes']
        asyncio.create_task(process_chunk_and_respond(ws, audio_bytes, video_time, language))
      else:
        # ignore other types
        pass
  except WebSocketDisconnect:
    print('client disconnected')
  except Exception as e:
    print('ws loop error', e); traceback.print_exc()

if __name__ == '__main__':
  uvicorn.run('server_whisperx:app', host='0.0.0.0', port=8000)
