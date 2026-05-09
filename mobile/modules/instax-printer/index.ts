import { requireNativeModule } from 'expo-modules-core';

export interface InstaxStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';
  deviceName?: string;
  batteryLevel?: number;
  filmRemaining?: number;
  errorMessage?: string;
}

export interface InstaxDevice {
  id: string;
  name: string;
  rssi: number;
}

interface InstaxPrinterModule {
  scanForDevices(timeoutMs: number): Promise<InstaxDevice[]>;
  connect(deviceId?: string): Promise<InstaxStatus>;
  disconnect(): Promise<InstaxStatus>;
  getStatus(): Promise<InstaxStatus>;
  print(imageUri: string): Promise<{ jobId: string }>;
}

export default requireNativeModule<InstaxPrinterModule>('InstaxPrinter');
