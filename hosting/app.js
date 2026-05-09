/**
 * PrintStax — Client upload app (Firebase Hosting)
 *
 * LOCAL DEV: If /__/firebase/init.js returns 404, uncomment and fill in below:
 *
 * firebase.initializeApp({
 *   apiKey: "...",
 *   authDomain: "YOUR_PROJECT.firebaseapp.com",
 *   projectId: "YOUR_PROJECT",
 *   storageBucket: "YOUR_PROJECT.appspot.com",
 *   messagingSenderId: "...",
 *   appId: "...",
 * });
 */

const db      = firebase.firestore();
const storage = firebase.storage();

const MAX_FILES   = 5;
const MAX_SIZE_MB = 15;

// ─── State ────────────────────────────────────────────────────────────────────
let sessionId  = null;
let session    = null;
let files      = [];
let clientName = '';
let clientDate = '';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const views = {
  loading:   document.getElementById('view-loading'),
  error:     document.getElementById('view-error'),
  form:      document.getElementById('view-form'),
  uploading: document.getElementById('view-uploading'),
  success:   document.getElementById('view-success'),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

function showError(title, body) {
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-body').textContent  = body;
  showView('error');
}

function setStep(n) {
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('completed', i + 1 < n);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  sessionId = new URLSearchParams(window.location.search).get('session');

  if (!sessionId) {
    showError('No session ID', 'Open this page by scanning the QR code provided by your photographer.');
    return;
  }

  try {
    const snap = await db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) {
      showError('Session not found', 'This QR code is invalid or has already expired.');
      return;
    }
    session = snap.data();

    if (Date.now() > session.expiresAt) {
      showError('Session expired', 'This QR code has expired. Ask your photographer for a new one.');
      return;
    }
    if (session.status !== 'waiting') {
      showError('Already submitted', 'Photos have already been uploaded for this session.');
      return;
    }

    showView('form');
    bindFormEvents();
  } catch (err) {
    showError('Connection error', err.message);
  }
})();

// ─── Form ─────────────────────────────────────────────────────────────────────
function bindFormEvents() {
  const inpName    = document.getElementById('inp-name');
  const inpDate    = document.getElementById('inp-date');
  const stepInfo   = document.getElementById('step-info');
  const stepPhotos = document.getElementById('step-photos');

  document.getElementById('btn-next').addEventListener('click', () => {
    clientName = inpName.value.trim();
    if (!clientName) { inpName.focus(); inpName.style.borderColor = 'var(--md-sys-color-error)'; return; }
    inpName.style.borderColor = '';
    clientDate = inpDate.value;
    stepInfo.classList.add('hidden');
    stepPhotos.classList.remove('hidden');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    stepPhotos.classList.add('hidden');
    stepInfo.classList.remove('hidden');
    setStep(1);
  });

  const fileInput = document.getElementById('file-input');
  const dropZone  = document.getElementById('drop-zone');

  fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });

  document.getElementById('chk-consent').addEventListener('change', updateSubmitBtn);
  document.getElementById('btn-submit').addEventListener('click', handleSubmit);
}

function handleFiles(incoming) {
  const images   = incoming.filter(f => f.type.startsWith('image/'));
  const oversized = images.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024);
  if (oversized.length) alert(`Some files exceed ${MAX_SIZE_MB} MB and were skipped.`);
  const valid = images.filter(f => f.size <= MAX_SIZE_MB * 1024 * 1024);
  files = [...files, ...valid].slice(0, MAX_FILES);
  renderPreviews();
}

function qualityOf(file) {
  const mp = file.size / (1024 * 1024 * 0.3);
  if (mp >= 1.0) return { cls: 'quality-good', text: 'Good' };
  if (mp >= 0.3) return { cls: 'quality-warn', text: 'OK'   };
  return { cls: 'quality-bad', text: 'Low' };
}

function renderPreviews() {
  const grid       = document.getElementById('preview-grid');
  const submitBtn  = document.getElementById('btn-submit');
  const consentWrap = document.getElementById('consent-wrap');

  grid.innerHTML = '';

  if (files.length === 0) {
    grid.classList.add('hidden');
    consentWrap.classList.add('hidden');
    submitBtn.classList.add('hidden');
    updateSubmitBtn();
    return;
  }

  grid.classList.remove('hidden');
  consentWrap.classList.remove('hidden');

  files.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const q   = qualityOf(f);
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <img src="${url}" alt="photo ${i + 1}" loading="lazy" />
      <button class="remove-fab" data-idx="${i}" title="Remove">
        <span class="material-symbols-rounded">close</span>
      </button>
      <span class="quality-chip ${q.cls}">${q.text}</span>
    `;
    grid.appendChild(item);
  });

  grid.querySelectorAll('.remove-fab').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      files.splice(Number(btn.dataset.idx), 1);
      renderPreviews();
    });
  });

  updateSubmitBtn();
}

function updateSubmitBtn() {
  const consent = document.getElementById('chk-consent').checked;
  const btn = document.getElementById('btn-submit');
  const show = files.length > 0 && consent;
  btn.classList.toggle('hidden', !show);
  btn.disabled = !show;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function handleSubmit() {
  const consent = document.getElementById('chk-consent').checked;
  if (!consent)         { alert('Please accept the consent checkbox.'); return; }
  if (files.length < 1) { alert('Please select at least one photo.'); return; }

  showView('uploading');
  const statusEl   = document.getElementById('upload-status');
  const progressEl = document.getElementById('progress-bar');

  try {
    const images = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      statusEl.textContent = `Uploading photo ${i + 1} of ${files.length}…`;
      progressEl.style.width = `${(i / files.length) * 85}%`;

      const ext         = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const uuid        = crypto.randomUUID();
      const storagePath = `sessions/${sessionId}/${uuid}.${ext}`;
      const fileRef     = storage.ref(storagePath);
      const snap        = await fileRef.put(file);
      const downloadUrl = await snap.ref.getDownloadURL();

      images.push({
        id:            uuid,
        storagePath,
        downloadUrl,
        processedPath: null,
        processedUrl:  null,
        originalName:  file.name,
        size:          file.size,
        uploadedAt:    Date.now(),
        hsl:           { hue: 0, saturation: 0, lightness: 0 },
        approved:      false,
        printed:       false,
      });
    }

    statusEl.textContent = 'Saving…';
    progressEl.style.width = '95%';

    await db.collection('sessions').doc(sessionId).update({
      client: { name: clientName, date: clientDate },
      images,
      status: 'pending',
    });

    progressEl.style.width = '100%';

    document.getElementById('success-count').textContent =
      `${images.length} photo${images.length !== 1 ? 's' : ''} uploaded successfully.`;
    showView('success');
  } catch (err) {
    showView('form');
    alert(`Upload failed: ${err.message}`);
  }
}
