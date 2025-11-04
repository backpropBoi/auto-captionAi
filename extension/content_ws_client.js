(async function () {
  // Content script: capture video audio via captureStream, send meta + binary to backend
  const TIMESLICE_MS = 1200;
  const settings = await new Promise(res => chrome.storage.local.get(['backendUrl','language','translate'], res));
  const backendUrl = settings.backendUrl || 'wss://localhost:8000/ws';
  const speechLang = settings.language || null;
  const translateLang = settings.translate || 'none';

  const video = document.querySelector('video');
  if (!video) { console.warn('No video element found'); return; }
  if (!video.captureStream) { console.warn('captureStream unsupported'); return; }

  const stream = video.captureStream();
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks || audioTracks.length === 0) { console.warn('No audio track'); return; }

  const wsUrl = backendUrl + ((backendUrl.indexOf('?')===-1)?'?':'&') + 'translate=' + encodeURIComponent(translateLang);
  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    console.log('ws connected', wsUrl);
    ws.send(JSON.stringify({ type: 'hello', url: location.href }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'word_timestamps') {
        window.AutoCaption && window.AutoCaption.handleWordTimestamps && window.AutoCaption.handleWordTimestamps(msg);
      } else if (msg.type === 'partial') {
        // optional: display partial immediately
        window.AutoCaption && window.AutoCaption.handlePartial && window.AutoCaption.handlePartial(msg.text);
      } else if (msg.type === 'error') {
        console.error('server error', msg);
      }
    } catch (e) {
      console.log('ws message', ev.data);
    }
  };

  ws.onerror = (e) => console.error('ws error', e);
  ws.onclose = (e) => console.log('ws closed', e);

  const options = { mimeType: 'audio/webm;codecs=opus' };
  let recorder;
  try { recorder = new MediaRecorder(stream, options); }
  catch (err) { console.error('MediaRecorder error', err); return; }

  recorder.ondataavailable = async (ev) => {
    if (!ev.data || ev.data.size===0) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      const meta = { type: 'meta', video_time: video.currentTime };
      if (speechLang) meta.language = speechLang;
      ws.send(JSON.stringify(meta));
      const arrayBuffer = await ev.data.arrayBuffer();
      ws.send(arrayBuffer);
    } catch (err) { console.error('send chunk failed', err); }
  };

  function startRecording() {
    if (recorder && recorder.state !== 'recording') {
      recorder.start(TIMESLICE_MS);
      console.log('recorder started');
    }
  }
  function stopRecording() {
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch(e){}
  }

  video.addEventListener('play', startRecording);
  video.addEventListener('pause', stopRecording);
  video.addEventListener('ended', stopRecording);
  if (!video.paused) startRecording();

  window.addEventListener('beforeunload', () => { stopRecording(); try { ws.close(); } catch(e){} });
})();
