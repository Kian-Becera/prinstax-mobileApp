const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ─── LAN IP detection ─────────────────────────────────────────────────────────
function getAllLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // Skip virtual adapters (WSL, Hyper-V, Docker, etc.)
      if (net.address.startsWith('172.') || net.address.startsWith('169.254')) continue;
      ips.push({ name, address: net.address });
    }
  }
  return ips;
}

function getBestLanIp() {
  const all = getAllLanIps();
  if (all.length === 0) return '0.0.0.0';
  // Prefer actual Wi-Fi adapter over hotspot (192.168.137.x) or ethernet
  const wifi = all.find(i => /wi-?fi|wlan|wireless/i.test(i.name));
  if (wifi) return wifi.address;
  // Prefer 192.168.x.x over 10.x.x.x
  const local = all.find(i => i.address.startsWith('192.168.') && !i.address.startsWith('192.168.137.'));
  if (local) return local.address;
  return all[0].address;
}

const LAN_IP    = getBestLanIp();
const ALL_IPS   = getAllLanIps();
const SERVER_URL = `http://${LAN_IP}:${PORT}`;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

[UPLOAD_DIR, DATA_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── JSON helpers ────────────────────────────────────────────────────────────
const readJSON = (file, def) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } };
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ─── Multer ──────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_DIR, req.params.sessionId || 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── State ────────────────────────────────────────────────────────────────────
let sessions = readJSON(SESSIONS_FILE, {});
let adminSocket = null;

const notifyAdmin = (event, data) => { if (adminSocket) adminSocket.emit(event, data); };

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('admin-connect', () => {
    adminSocket = socket;
    socket.emit('sessions-update', Object.values(sessions));
    socket.emit('stats-update', buildStats());
  });
  socket.on('disconnect', () => {
    if (adminSocket?.id === socket.id) adminSocket = null;
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildStats() {
  const history = readJSON(HISTORY_FILE, []);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  return {
    totalPrints: history.length,
    todayPrints: history.filter(h => h.printedAt >= todayStart.getTime()).length,
    pendingSessions: Object.values(sessions).filter(s => s.status === 'pending').length,
    activeSessions: Object.values(sessions).filter(s => !['deleted', 'completed'].includes(s.status)).length,
  };
}

function deleteSessionFiles(sessionId) {
  const dir = path.join(UPLOAD_DIR, sessionId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Server info — mobile app calls this to verify reachability + get canonical URL
app.get('/api/server-info', (req, res) => {
  res.json({ ip: LAN_IP, port: PORT, serverUrl: SERVER_URL, allIps: ALL_IPS, ok: true });
});

// Setup page — open this in a browser, scan the QR in the mobile app to auto-configure
app.get('/setup', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>PrintStax Setup</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A0A0A;color:#fff;font-family:system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px}
    h1{font-size:22px;font-weight:700}
    p{color:#9CA3AF;font-size:13px;text-align:center;max-width:280px;line-height:1.6}
    .qr-wrap{background:#fff;padding:16px;border-radius:20px}
    .url{background:#1E1E1E;border-radius:12px;padding:10px 16px;font-size:12px;color:#F97316;word-break:break-all;max-width:320px;text-align:center}
    .step{font-size:12px;color:#6B7280;text-align:center}
  </style>
</head>
<body>
  <h1>PrintStax Admin Setup</h1>
  <p>Scan this QR code in the PrintStax app → Settings → Scan Server QR to auto-configure the server URL.</p>
  <div class="qr-wrap" id="qr"></div>
  <div class="url">${SERVER_URL}</div>
  <p class="step">Or type the URL above manually in Settings → Server Connection</p>
  <script>new QRCode(document.getElementById('qr'),{text:'${SERVER_URL}',width:220,height:220,colorDark:'#0A0A0A',colorLight:'#ffffff'})</script>
</body>
</html>`);
});

// Create a new upload session (admin calls this to generate QR)
app.post('/api/sessions', (req, res) => {
  const id = uuidv4();
  const session = {
    id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    status: 'waiting', // waiting → pending → approved → completed
    client: null,
    images: [],
  };
  sessions[id] = session;
  writeJSON(SESSIONS_FILE, sessions);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({ id, url: `${baseUrl}/?session=${id}` });
});

// Client uploads images
app.post('/api/upload/:sessionId', upload.array('images', 5), async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  if (session.status !== 'waiting') return res.status(400).json({ error: 'Session already has uploads' });

  const { clientName, date, consent } = req.body;
  if (consent !== 'true') return res.status(400).json({ error: 'Consent required' });
  if (!clientName?.trim()) return res.status(400).json({ error: 'Name required' });
  if (!(req.files?.length > 0)) return res.status(400).json({ error: 'At least one image required' });

  const images = req.files.map(f => ({
    id: uuidv4(),
    filename: f.filename,
    path: `/uploads/${sessionId}/${f.filename}`,
    originalName: f.originalname,
    size: f.size,
    uploadedAt: Date.now(),
    hsl: { hue: 0, saturation: 0, lightness: 0 },
    processedPath: null,
    approved: false,
    printed: false,
  }));

  session.client = { name: clientName.trim(), date: date || '' };
  session.images = images;
  session.status = 'pending';
  writeJSON(SESSIONS_FILE, sessions);

  notifyAdmin('new-upload', { session });
  notifyAdmin('stats-update', buildStats());
  res.json({ success: true, count: images.length });
});

// Get all sessions
app.get('/api/sessions', (req, res) => {
  res.json(Object.values(sessions).filter(s => s.status !== 'deleted').sort((a, b) => b.createdAt - a.createdAt));
});

// Get one session
app.get('/api/sessions/:id', (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// Process image: apply HSL + auto-crop to Instax Mini ratio
app.post('/api/sessions/:sessionId/images/:imageId/process', async (req, res) => {
  const { sessionId, imageId } = req.params;
  const { hsl, crop } = req.body;
  const session = sessions[sessionId];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const image = session.images.find(i => i.id === imageId);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  const srcPath = path.join(UPLOAD_DIR, sessionId, image.filename);
  const outName = `proc_${imageId}.jpg`;
  const outPath = path.join(UPLOAD_DIR, sessionId, outName);

  try {
    let s = sharp(srcPath);
    const meta = await s.metadata();

    if (crop && crop.width && crop.height) {
      s = s.extract({ left: Math.round(crop.x), top: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) });
    } else {
      // Auto-crop to Instax Mini print area ratio (62:46 ≈ 1.348)
      const targetRatio = 62 / 46;
      const imgRatio = meta.width / meta.height;
      if (imgRatio > targetRatio) {
        const nw = Math.round(meta.height * targetRatio);
        s = s.extract({ left: Math.round((meta.width - nw) / 2), top: 0, width: nw, height: meta.height });
      } else {
        const nh = Math.round(meta.width / targetRatio);
        s = s.extract({ left: 0, top: Math.round((meta.height - nh) / 2), width: meta.width, height: nh });
      }
    }

    if (hsl) {
      const { hue = 0, saturation = 0, lightness = 0 } = hsl;
      s = s.modulate({
        brightness: Math.max(0.1, 1 + lightness / 100),
        saturation: Math.max(0, 1 + saturation / 100),
        hue,
      });
    }

    await s.jpeg({ quality: 95 }).toFile(outPath);

    image.processedPath = `/uploads/${sessionId}/${outName}`;
    image.hsl = hsl ?? image.hsl;
    image.crop = crop ?? image.crop;
    writeJSON(SESSIONS_FILE, sessions);

    res.json({ path: image.processedPath });
  } catch (err) {
    console.error('Process error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Approve images (batch or individual)
app.post('/api/sessions/:sessionId/approve', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).json({ error: 'Not found' });

  const { imageIds } = req.body; // 'all' or string[]
  if (imageIds === 'all') {
    session.images.forEach(i => (i.approved = true));
  } else if (Array.isArray(imageIds)) {
    imageIds.forEach(id => { const img = session.images.find(i => i.id === id); if (img) img.approved = true; });
  }
  session.status = 'approved';
  writeJSON(SESSIONS_FILE, sessions);
  notifyAdmin('session-update', { session });
  res.json({ success: true });
});

// Log a print
app.post('/api/print', (req, res) => {
  const { sessionId, imageId } = req.body;
  const session = sessions[sessionId];
  const img = session?.images.find(i => i.id === imageId);

  const entry = {
    id: uuidv4(),
    sessionId,
    imageId,
    clientName: session?.client?.name ?? 'Unknown',
    clientDate: session?.client?.date ?? '',
    thumbnail: img?.processedPath ?? img?.path ?? null,
    printedAt: Date.now(),
  };

  const history = readJSON(HISTORY_FILE, []);
  history.push(entry);
  writeJSON(HISTORY_FILE, history);

  if (img) img.printed = true;
  if (session && session.images.every(i => i.printed)) session.status = 'completed';
  if (session) writeJSON(SESSIONS_FILE, sessions);

  notifyAdmin('print-logged', { entry });
  notifyAdmin('stats-update', buildStats());
  res.json({ success: true, entry });
});

// Get history
app.get('/api/history', (req, res) => {
  const history = readJSON(HISTORY_FILE, []);
  res.json(history.slice().reverse());
});

// Get stats
app.get('/api/stats', (req, res) => res.json(buildStats()));

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  if (sessions[id]) {
    deleteSessionFiles(id);
    delete sessions[id];
    writeJSON(SESSIONS_FILE, sessions);
    notifyAdmin('session-deleted', { id });
  }
  res.json({ success: true });
});

// Verify admin PIN
app.post('/api/auth/verify', (req, res) => {
  const { pin } = req.body;
  const expected = process.env.ADMIN_PIN || '1234';
  res.json({ valid: pin === expected });
});

// ─── Cron: cleanup sessions older than 24 hrs ─────────────────────────────────
cron.schedule('*/5 * * * *', () => {
  const now = Date.now();
  let changed = false;
  Object.entries(sessions).forEach(([id, s]) => {
    if (now > s.expiresAt) {
      deleteSessionFiles(id);
      delete sessions[id];
      changed = true;
      console.log(`[cleanup] Removed session ${id}`);
    }
  });
  if (changed) {
    writeJSON(SESSIONS_FILE, sessions);
    notifyAdmin('sessions-update', Object.values(sessions));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║  PrintStax Server — ONLINE                         ║`);
  console.log(`╠════════════════════════════════════════════════════╣`);
  console.log(`║  Local:   http://localhost:${PORT}                     ║`);
  ALL_IPS.forEach(({ name, address }) => {
    const label = `  ${name}: http://${address}:${PORT}`;
    console.log(`║ ${label.padEnd(51)}║`);
  });
  console.log(`╠════════════════════════════════════════════════════╣`);
  console.log(`║  Admin setup QR:                                   ║`);
  console.log(`║  ${(SERVER_URL + '/setup').padEnd(50)}║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  console.log(`  → USE THIS IP IN THE APP: ${SERVER_URL}\n`);
  console.log(`  → Scan the QR at ${SERVER_URL}/setup to auto-configure\n`);
});
