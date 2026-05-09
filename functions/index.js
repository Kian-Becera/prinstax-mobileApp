const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ─── processImage ─────────────────────────────────────────────────────────────
// Called by admin mobile app to apply HSL adjustments + Instax Mini crop.
exports.processImage = onCall({ timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Admin login required.');

  const { sessionId, imageId, hsl, crop } = request.data;
  if (!sessionId || !imageId) throw new HttpsError('invalid-argument', 'sessionId and imageId required.');

  const sessionRef = db.collection('sessions').doc(sessionId);
  const snap = await sessionRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Session not found.');

  const session = snap.data();
  const image = (session.images ?? []).find(i => i.id === imageId);
  if (!image) throw new HttpsError('not-found', 'Image not found.');

  // Download original from Firebase Storage
  const srcFile = bucket.file(image.storagePath);
  const [buffer] = await srcFile.download();

  // ── Apply sharp transformations ──────────────────────────────────────────
  let s = sharp(buffer);
  const meta = await s.metadata();

  if (crop && crop.width && crop.height) {
    s = s.extract({
      left: Math.round(crop.x),
      top: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    });
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

  const processedBuffer = await s.jpeg({ quality: 95 }).toBuffer();

  // ── Upload processed image to Storage ───────────────────────────────────
  const processedPath = `sessions/${sessionId}/proc_${imageId}.jpg`;
  const outFile = bucket.file(processedPath);
  await outFile.save(processedBuffer, { contentType: 'image/jpeg' });

  // Get a long-lived signed URL (10 years)
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 10);
  const [processedUrl] = await outFile.getSignedUrl({ action: 'read', expires: expiry });

  // ── Update Firestore ─────────────────────────────────────────────────────
  const updatedImages = session.images.map(i => {
    if (i.id !== imageId) return i;
    return {
      ...i,
      processedPath,
      processedUrl,
      hsl: hsl ?? i.hsl,
      crop: crop ?? i.crop ?? null,
    };
  });
  await sessionRef.update({ images: updatedImages });

  return { processedUrl };
});

// ─── githubTokenExchange ──────────────────────────────────────────────────────
// Exchanges a GitHub OAuth authorization code for an access token.
// The client_secret stays in the Function environment, never in the mobile app.
exports.githubTokenExchange = onCall(async (request) => {
  const { code, redirectUri } = request.data;
  if (!code) throw new HttpsError('invalid-argument', 'code required.');

  const clientId     = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpsError('internal', 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in functions/.env');
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });

  const res = await fetch(`https://github.com/login/oauth/access_token?${params}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  const json = await res.json();
  if (json.error) throw new HttpsError('permission-denied', json.error_description ?? json.error);

  return { access_token: json.access_token };
});

// ─── logPrint ────────────────────────────────────────────────────────────────
// Logs a print entry to the history collection and marks the image as printed.
exports.logPrint = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Admin login required.');

  const { sessionId, imageId } = request.data;
  if (!sessionId || !imageId) throw new HttpsError('invalid-argument', 'sessionId and imageId required.');

  const sessionRef = db.collection('sessions').doc(sessionId);
  const snap = await sessionRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Session not found.');

  const session = snap.data();
  const image = (session.images ?? []).find(i => i.id === imageId);

  const entry = {
    id: uuidv4(),
    sessionId,
    imageId,
    clientName: session.client?.name ?? 'Unknown',
    clientDate: session.client?.date ?? '',
    thumbnail: image?.processedUrl ?? image?.downloadUrl ?? null,
    printedAt: Date.now(),
  };

  await db.collection('history').doc(entry.id).set(entry);

  // Mark image as printed; if all images printed → status = completed
  const updatedImages = (session.images ?? []).map(i =>
    i.id === imageId ? { ...i, printed: true } : i,
  );
  const allPrinted = updatedImages.every(i => i.printed);
  await sessionRef.update({
    images: updatedImages,
    ...(allPrinted ? { status: 'completed' } : {}),
  });

  return { entry };
});

// ─── scheduledCleanup ────────────────────────────────────────────────────────
// Runs every hour, deletes sessions that have passed their 24 h expiry.
exports.scheduledCleanup = onSchedule('every 60 minutes', async () => {
  const now = Date.now();
  const expired = await db.collection('sessions')
    .where('expiresAt', '<', now)
    .get();

  const deletions = expired.docs.map(async snap => {
    const sessionId = snap.id;

    // Delete all Storage files for the session
    try {
      const [files] = await bucket.getFiles({ prefix: `sessions/${sessionId}/` });
      await Promise.all(files.map(f => f.delete()));
    } catch (err) {
      console.error(`Storage cleanup failed for session ${sessionId}:`, err.message);
    }

    // Delete the Firestore document
    await snap.ref.delete();
    console.log(`[cleanup] Removed session ${sessionId}`);
  });

  await Promise.all(deletions);
  console.log(`[cleanup] Processed ${expired.docs.length} expired sessions.`);
});
