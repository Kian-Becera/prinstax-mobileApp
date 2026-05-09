import { NativeModulesProxy } from 'expo-modules-core';

export type InstaxConnectionState = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

export interface InstaxStatus {
  state: InstaxConnectionState;
  deviceName?: string;
  batteryLevel?: number;
  filmRemaining?: number;
  errorMessage?: string;
}

interface InstaxPrinterNativeModule {
  connect(deviceId?: string): Promise<InstaxStatus>;
  disconnect(): Promise<InstaxStatus>;
  getStatus(): Promise<InstaxStatus>;
  print(imageUri: string): Promise<{ jobId: string }>;
  scanForDevices(timeoutMs: number): Promise<Array<{ id: string; name: string; rssi: number }>>;
}

const Native: InstaxPrinterNativeModule | undefined =
  (NativeModulesProxy as unknown as Record<string, InstaxPrinterNativeModule | undefined>).InstaxPrinter;

let mockState: InstaxStatus = { state: 'disconnected' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const isNativeBacked = (): boolean => Boolean(Native);

export async function scanForDevices(timeoutMs = 4000) {
  if (Native) return Native.scanForDevices(timeoutMs);
  await sleep(800);
  return [
    { id: 'mock-instax-mini-1', name: 'INSTAX-MINI Link 2 (mock)', rssi: -52 },
    { id: 'mock-instax-square-1', name: 'INSTAX SQUARE Link (mock)', rssi: -67 },
  ];
}

export async function connect(deviceId?: string): Promise<InstaxStatus> {
  if (Native) return Native.connect(deviceId);
  mockState = { state: 'connecting' };
  await sleep(700);
  mockState = {
    state: 'connected',
    deviceName: deviceId ?? 'INSTAX (mock)',
    batteryLevel: 0.82,
    filmRemaining: 8,
  };
  return mockState;
}

export async function disconnect(): Promise<InstaxStatus> {
  if (Native) return Native.disconnect();
  mockState = { state: 'disconnected' };
  return mockState;
}

export async function getStatus(): Promise<InstaxStatus> {
  if (Native) return Native.getStatus();
  return mockState;
}

export async function print(imageUri: string): Promise<{ jobId: string }> {
  if (Native) return Native.print(imageUri);
  if (mockState.state !== 'connected') {
    throw new Error('Printer not connected');
  }
  mockState = { ...mockState, state: 'printing' };
  await sleep(2200);
  if (mockState.filmRemaining !== undefined) {
    mockState = {
      ...mockState,
      state: 'connected',
      filmRemaining: Math.max(0, mockState.filmRemaining - 1),
    };
  } else {
    mockState = { ...mockState, state: 'connected' };
  }
  return { jobId: `mock-${Date.now()}` };
}
