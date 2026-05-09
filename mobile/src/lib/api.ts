import axios from 'axios';
import { config } from './config';

const client = axios.create({
  baseURL: config.serverUrl,
  timeout: 15000,
});

export interface ServerSession {
  id: string;
  status: 'pending' | 'uploaded' | 'reviewed' | 'completed';
  clientName?: string;
  clientDate?: string;
  consent?: boolean;
  imageUrls: string[];
  createdAt: number;
}

export async function createServerSession(sessionId: string): Promise<{ uploadUrl: string }> {
  const { data } = await client.post('/api/sessions', { id: sessionId });
  return data;
}

export async function fetchServerSession(sessionId: string): Promise<ServerSession | null> {
  try {
    const { data } = await client.get<ServerSession>(`/api/sessions/${sessionId}`);
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function listServerSessions(): Promise<ServerSession[]> {
  const { data } = await client.get<ServerSession[]>('/api/sessions');
  return data;
}

export async function markSessionCompleted(sessionId: string): Promise<void> {
  await client.post(`/api/sessions/${sessionId}/complete`);
}

export const buildClientUploadUrl = (sessionId: string): string =>
  `${config.serverUrl.replace(/\/$/, '')}/upload/${sessionId}`;

export const absoluteUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  return `${config.serverUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
};
