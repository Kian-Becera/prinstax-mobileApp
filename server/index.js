require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const PORT = parseInt(process.env.PORT || '4000', 10);
const RETENTION_MS = parseInt(process.env.RETENTION_HOURS || '24', 10) * 60 * 60 * 1000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_FILE = path.join(__dirname, 'sessions.json');
const MAX_IMAGES = 5;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let sessions = (() => {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch { return {}; }
})();

const persist = () => {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2)); }
  catch (e) { console.error('persist failed', e); }
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/files', express.static(UPLOAD_DIR, { maxAge: '1h' }));
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = req.params.id;
    const dir = path.join(UPLOAD_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_BYTES, files: MAX_IMAGES } });

app.get('/upload/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/api/sessions', (_req, res) => {
  const arr = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);
  res.json(arr);
});

app.post('/api/sessions', (req, res) => {
  const id = (req.body && req.body.id) || `s_${Date.now().toString(36)}`;
  if (sessions[id]) return res.status(409).json({ error: 'session exists' });
  const now = Date.now();
  sessions[id] = {
    id,
    status: 'pending',
    imageUrls: [],
    createdAt: now,
    expiresAt: now + RETENTION_MS,
  };
  persist();
  res.json({ id, uploadUrl: `/upload/${id}` });
});

app.get('/api/sessions/:id', (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json(s);
});

app.post('/api/sessions/:id/complete', (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  s.status = 'completed';
  persist();
  res.json(s);
});

app.post('/api/sessions/:id/upload', upload.array('images', MAX_IMAGES), (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'not found' });

  const { name, date, consent } = req.body;
  if (!consent || consent !== 'true') {
    return res.status(400).json({ error: 'consent required' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'no files' });
  }

  s.clientName = (name || '').toString().slice(0, 80);
  s.clientDate = (date || '').toString().slice(0, 40);
  s.consent = true;
  s.imageUrls = req.files.map((f) => `/files/${id}/${path.basename(f.path)}`);
  s.status = 'uploaded';
  persist();
  res.json({ ok: true, session: s });
});

app.post('/api/cleanup', (_req, res) => {
  const now = Date.now();
  let removed = 0;
  for (const id of Object.keys(sessions)) {
    if (sessions[id].expiresAt <= now) {
      const dir = path.join(UPLOAD_DIR, id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      delete sessions[id];
      removed += 1;
    }
  }
  if (removed > 0) persist();
  res.json({ removed });
});

setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const id of Object.keys(sessions)) {
    if (sessions[id].expiresAt <= now) {
      const dir = path.join(UPLOAD_DIR, id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      delete sessions[id];
      removed += 1;
    }
  }
  if (removed > 0) {
    persist();
    console.log(`[cleanup] removed ${removed} expired session(s)`);
  }
}, 30 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prinstax server listening on http://0.0.0.0:${PORT}`);
  console.log('From a phone on the same Wi-Fi, hit http://<your-LAN-IP>:' + PORT);
});
