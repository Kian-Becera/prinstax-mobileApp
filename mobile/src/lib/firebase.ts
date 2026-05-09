import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { config, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

const ensureApp = (): { app: FirebaseApp; db: Firestore } | null => {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config.firebase);
    db = getFirestore(app);
  }
  return { app: app!, db: db! };
};

export type SessionStatus = 'pending' | 'uploaded' | 'reviewed' | 'completed';

export interface SessionDoc {
  id: string;
  status: SessionStatus;
  clientName?: string;
  clientDate?: string;
  consent?: boolean;
  imageUrls: string[];
  createdAt: number;
  expiresAt: number;
}

export interface PrintLogDoc {
  id?: string;
  sessionId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  clientName?: string;
  printedAt: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

const SESSIONS = 'sessions';
const PRINT_LOGS = 'printLogs';
const COUNTERS = 'counters';

export async function createSession(sessionId: string): Promise<void> {
  const ctx = ensureApp();
  const now = Date.now();
  const expires = now + config.imageRetentionMs;
  const payload = {
    status: 'pending' as SessionStatus,
    imageUrls: [],
    createdAt: now,
    expiresAt: expires,
    serverCreatedAt: serverTimestamp(),
  };
  if (!ctx) {
    console.warn('[firebase] not configured — createSession is a no-op');
    return;
  }
  await setDoc(doc(ctx.db, SESSIONS, sessionId), payload);
}

export async function getSession(sessionId: string): Promise<SessionDoc | null> {
  const ctx = ensureApp();
  if (!ctx) return null;
  const snap = await getDoc(doc(ctx.db, SESSIONS, sessionId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<SessionDoc, 'id'>;
  return { id: snap.id, ...data };
}

export async function listRecentSessions(max = 20): Promise<SessionDoc[]> {
  const ctx = ensureApp();
  if (!ctx) return [];
  const q = query(
    collection(ctx.db, SESSIONS),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessionDoc, 'id'>) }));
}

export async function deleteExpiredSessions(): Promise<number> {
  const ctx = ensureApp();
  if (!ctx) return 0;
  const now = Date.now();
  const q = query(collection(ctx.db, SESSIONS), where('expiresAt', '<=', now));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

export async function logPrint(entry: Omit<PrintLogDoc, 'id'>): Promise<void> {
  const ctx = ensureApp();
  if (!ctx) return;
  await addDoc(collection(ctx.db, PRINT_LOGS), entry);
  await incrementDailyCounter();
}

export async function listPrintLogs(max = 100): Promise<PrintLogDoc[]> {
  const ctx = ensureApp();
  if (!ctx) return [];
  const q = query(
    collection(ctx.db, PRINT_LOGS),
    orderBy('printedAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrintLogDoc, 'id'>) }));
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function incrementDailyCounter(): Promise<void> {
  const ctx = ensureApp();
  if (!ctx) return;
  const key = todayKey();
  const ref = doc(ctx.db, COUNTERS, key);
  const snap = await getDoc(ref);
  const current = snap.exists() ? ((snap.data().count as number) ?? 0) : 0;
  await setDoc(ref, { count: current + 1, day: key, updatedAt: Timestamp.now() });
}

export async function getDailyCount(): Promise<number> {
  const ctx = ensureApp();
  if (!ctx) return 0;
  const snap = await getDoc(doc(ctx.db, COUNTERS, todayKey()));
  return snap.exists() ? ((snap.data().count as number) ?? 0) : 0;
}
