document.addEventListener('DOMContentLoaded', async () => {
  const backendInput = document.getElementById('backend-url');
  const speechSelect = document.getElementById('speech-lang');
  const translateSelect = document.getElementById('translate-lang');
  const saveBtn = document.getElementById('save');
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const status = document.getElementById('status');

  chrome.storage.local.get(['backendUrl','speechLang','translateLang'], (res) => {
    if (res.backendUrl) backendInput.value = res.backendUrl;
    if (res.speechLang) speechSelect.value = res.speechLang;
    if (res.translateLang) translateSelect.value = res.translateLang;
  });

  saveBtn.addEventListener('click', async () => {
    const backendUrl = backendInput.value.trim();
    const speechLang = speechSelect.value;
    const translateLang = translateSelect.value;
    await chrome.storage.local.set({ backendUrl, language: speechLang, translate: translateLang });
    status.textContent = '✅ Settings saved';
  });

  startBtn.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'START_CAPTIONS' });
    status.textContent = '🎙️ Captions started (make sure this tab has a playing video)';
  });

  stopBtn.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'STOP_CAPTIONS' });
    status.textContent = '🛑 Captions stopped';
  });
});
