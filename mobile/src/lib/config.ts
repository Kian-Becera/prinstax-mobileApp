import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CONNECTION_MODE: 'prinstax_connection_mode',
  PRINTER_IP:      'prinstax_printer_ip',
} as const;

export type ConnectionMode = 'bluetooth' | 'wifi';

export async function getConnectionMode(): Promise<ConnectionMode> {
  const v = await AsyncStorage.getItem(KEYS.CONNECTION_MODE);
  return (v as ConnectionMode) ?? 'bluetooth';
}

export async function setConnectionMode(mode: ConnectionMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.CONNECTION_MODE, mode);
}

export async function getPrinterIp(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.PRINTER_IP)) ?? '';
}

export async function setPrinterIp(ip: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.PRINTER_IP, ip);
}
