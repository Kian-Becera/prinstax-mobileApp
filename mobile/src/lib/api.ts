import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { ref, deleteObject, listAll } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageEntry {
  id: string;
  storagePath: string;
  downloadUrl: string;
  processedPath: string | null;
  processedUrl: string | null;
  originalName: string;
  size: number;
  uploadedAt: number;
  hsl: { hue: number; saturation: number; lightness: number };
  crop?: { x: number; y: number; width: number; height: number } | null;
  approved: boolean;
  printed: boolean;
}

export interface Session {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'waiting' | 'pending' | 'approved' | 'completed';
  client: { name: string; date: string } | null;
  images: ImageEntry[];
}

export interface HistoryEntry {
  id: string;
  sessionId: string;
  imageId: string;
  clientName: string;
  clientDate: string;
  thumbnail: string | null;
  printedAt: number;
}

export interface Stats {
  totalPrints: number;
  todayPrints: number;
  pendingSessions: number;
  activeSessions: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToSession(d: { id: string; data: () => any }): Session {
  return { id: d.id, ...d.data() } as Session;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(): Promise<{ id: string; url: string }> {
  const hostingUrl = process.env.EXPO_PUBLIC_HOSTING_URL ?? '';
  const { id } = await addDoc(collection(db, 'sessions'), {
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    status: 'waiting',
    client: null,
    images: [],
  });
  return { id, url: `${hostingUrl}/?session=${id}` };
}

export async function getSessions(): Promise<Session[]> {
  const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToSession).filter(s => s.status !== 'completed');
}

export async function getSession(id: string): Promise<Session> {
  const snap = await getDoc(doc(db, 'sessions', id));
  if (!snap.exists()) throw new Error('Session not found');
  return docToSession(snap as any);
}

export async function deleteSession(id: string): Promise<void> {
  // Delete all storage files for this session
  try {
    const sessionRef = ref(storage, `sessions/${id}`);
    const { items } = await listAll(sessionRef);
    await Promise.all(items.map(item => deleteObject(item)));
  } catch { /* Storage cleanup is best-effort */ }
  await deleteDoc(doc(db, 'sessions', id));
}

export async function approveImages(sessionId: string, imageIds: string[] | 'all'): Promise<void> {
  const snap = await getDoc(doc(db, 'sessions', sessionId));
  if (!snap.exists()) throw new Error('Session not found');
  const session = snap.data() as Session;

  const updatedImages = session.images.map(img => ({
    ...img,
    approved: imageIds === 'all' || imageIds.includes(img.id),
  }));
  await updateDoc(doc(db, 'sessions', sessionId), {
    images: updatedImages,
    status: 'approved',
  });
}

// ─── Real-time subscription ───────────────────────────────────────────────────

export function subscribeSessions(cb: (sessions: Session[]) => void): () => void {
  const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(docToSession).filter(s => s.status !== 'completed'));
  });
}

// ─── Image processing (via Cloud Function) ────────────────────────────────────

export async function processImage(
  sessionId: string,
  imageId: string,
  hsl: { hue: number; saturation: number; lightness: number },
  crop?: { x: number; y: number; width: number; height: number } | null,
): Promise<{ processedUrl: string }> {
  const fn = httpsCallable<object, { processedUrl: string }>(functions, 'processImage');
  const { data } = await fn({ sessionId, imageId, hsl, crop });
  return data;
}

// ─── Print logging (via Cloud Function) ──────────────────────────────────────

export async function logPrint(sessionId: string, imageId: string): Promise<HistoryEntry> {
  const fn = httpsCallable<object, { entry: HistoryEntry }>(functions, 'logPrint');
  const { data } = await fn({ sessionId, imageId });
  return data.entry;
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function getHistory(): Promise<HistoryEntry[]> {
  const q = query(collection(db, 'history'), orderBy('printedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryEntry));
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [sessions, historySnap] = await Promise.all([
    getSessions(),
    getDocs(collection(db, 'history')),
  ]);
  const history = historySnap.docs.map(d => d.data() as HistoryEntry);
  return {
    totalPrints:      history.length,
    todayPrints:      history.filter(h => h.printedAt >= todayStart.getTime()).length,
    pendingSessions:  sessions.filter(s => s.status === 'pending').length,
    activeSessions:   sessions.filter(s => !['completed'].includes(s.status)).length,
  };
}
