// Prinstax client web app
(function () {
  'use strict';

  const MAX_IMAGES = 5;
  // Instax Mini print area: 800x600 is a safe baseline (≈133 DPI at 6x4.5cm)
  const MIN_MEGAPIXELS = 0.3;
  const WARN_MEGAPIXELS = 1.0;

  let sessionId = null;
  let selectedFiles = []; // { file, dataUrl, quality }

  // ── Screens ────────────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  function showError(msg) {
    document.getElementById('error-message').textContent = msg;
    showScreen('screen-error');
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('session');

    if (!sessionId) return showError('No session ID found. Please scan the QR code again.');

    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Session not found or expired.');
      const session = await res.json();
      if (session.status !== 'waiting') {
        return showError('This session has already been used. Ask the admin to generate a new QR code.');
      }
      // Pre-fill today's date
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('input-date').value = today;
      showScreen('screen-main');
    } catch (e) {
      showError(e.message || 'Could not connect to server.');
    }
  }

  // ── File handling ───────────────────────────────────────────────────────────
  window.openFilePicker = () => {
    if (selectedFiles.length >= MAX_IMAGES) return;
    document.getElementById('file-input').click();
  };

  window.openCamera = () => {
    if (selectedFiles.length >= MAX_IMAGES) return;
    document.getElementById('camera-input').click();
  };

  window.handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // reset so same file can be re-added
    const remaining = MAX_IMAGES - selectedFiles.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      const entry = await processFile(file);
      selectedFiles.push(entry);
    }
    renderGrid();
  };

  async function processFile(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const mp = (img.width * img.height) / 1_000_000;
          let quality = 'good';
          if (mp < MIN_MEGAPIXELS) quality = 'bad';
          else if (mp < WARN_MEGAPIXELS) quality = 'warn';
          resolve({ file, dataUrl, quality, width: img.width, height: img.height, mp });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  window.removeImage = (index) => {
    selectedFiles.splice(index, 1);
    renderGrid();
  };

  function renderGrid() {
    const grid = document.getElementById('image-grid');
    const countEl = document.getElementById('image-count');
    const addBtns = document.getElementById('add-buttons');
    const warnings = document.getElementById('quality-warnings');

    countEl.textContent = `${selectedFiles.length} / ${MAX_IMAGES}`;
    grid.innerHTML = '';
    warnings.innerHTML = '';

    let hasWarning = false;

    selectedFiles.forEach((entry, i) => {
      const div = document.createElement('div');
      div.className = 'img-thumb';
      div.innerHTML = `
        <img src="${entry.dataUrl}" alt="Photo ${i + 1}" />
        <button class="remove-btn" onclick="removeImage(${i})">✕</button>
        <span class="quality-badge quality-${entry.quality}">${entry.quality === 'good' ? 'OK' : entry.quality === 'warn' ? 'Low' : 'Too Low'}</span>
      `;
      grid.appendChild(div);

      if (entry.quality !== 'good') {
        hasWarning = true;
        const w = document.createElement('div');
        w.className = `text-xs px-3 py-2 rounded-lg ${entry.quality === 'bad' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'}`;
        w.textContent = entry.quality === 'bad'
          ? `Photo ${i + 1}: Very low resolution (${entry.width}×${entry.height}) — print quality will be poor.`
          : `Photo ${i + 1}: Low resolution (${entry.width}×${entry.height}) — print may look grainy.`;
        warnings.appendChild(w);
      }
    });

    warnings.classList.toggle('hidden', !hasWarning);
    addBtns.classList.toggle('hidden', selectedFiles.length >= MAX_IMAGES);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  window.submitForm = async () => {
    const name = document.getElementById('input-name').value.trim();
    const date = document.getElementById('input-date').value;
    const consent = document.getElementById('consent-check').checked;
    const errEl = document.getElementById('submit-error');

    errEl.classList.add('hidden');

    if (!name) return showSubmitError('Please enter your name.');
    if (selectedFiles.length === 0) return showSubmitError('Please add at least one photo.');
    if (!consent) return showSubmitError('Please accept the consent checkbox.');

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const formData = new FormData();
      formData.append('clientName', name);
      formData.append('date', date);
      formData.append('consent', 'true');
      selectedFiles.forEach(entry => formData.append('images', entry.file));

      const res = await fetch(`/api/upload/${sessionId}`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      showScreen('screen-success');
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Send to Print Station';
      showSubmitError(e.message || 'Upload failed. Please try again.');
    }
  };

  function showSubmitError(msg) {
    const el = document.getElementById('submit-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
