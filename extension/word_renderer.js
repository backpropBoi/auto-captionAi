(function () {
  let overlay = document.getElementById('autoCaptionOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'autoCaptionOverlay';
    overlay.style.position = 'absolute';
    overlay.style.bottom = '6%';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';
    document.body.appendChild(overlay);
  }

  const scheduled = [];
  function clearScheduled() {
    while (scheduled.length) clearTimeout(scheduled.pop());
  }

  function scheduleWords(words, chunkStart) {
    const video = document.querySelector('video');
    if (!video) return;
    clearScheduled();
    const line = document.createElement('div');
    line.className = 'caption-line';
    overlay.appendChild(line);
    // Remove after 10s
    scheduled.push(setTimeout(()=>line.remove(), 10000));

    const nowVideoTime = video.currentTime;
    words.forEach(w => {
      const delayMs = Math.max(0, (w.start - nowVideoTime) * 1000);
      const span = document.createElement('span');
      span.style.opacity = '0.25';
      span.style.marginRight = '6px';
      span.textContent = w.word;
      line.appendChild(span);
      scheduled.push(setTimeout(()=>{ span.style.transition='opacity 0.06s'; span.style.opacity='1'; }, delayMs));
    });
  }

  // Expose handlers
  window.AutoCaption = window.AutoCaption || {};
  window.AutoCaption.handleWordTimestamps = function(payload) {
    // payload: { chunk_start_time, words: [{word,start,end,confidence}, ...] }
    scheduleWords(payload.words, payload.chunk_start_time);
  };
  // Optional partial handler
  window.AutoCaption.handlePartial = function(text) {
    // simple progressive reveal as fallback
    let tmp = overlay.querySelector('.caption-line');
    if (!tmp) {
      tmp = document.createElement('div'); tmp.className='caption-line'; overlay.appendChild(tmp);
    }
    tmp.textContent = text;
    setTimeout(()=>{ try{ tmp.remove(); }catch{} }, 4000);
  };
})();
