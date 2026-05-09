/**
 * Instax Printer interface — supports Bluetooth and WiFi connection modes.
 *
 * In Expo Go this module simulates the full printer lifecycle.
 * For a production dev build, replace the scan/connect/print bodies with:
 *   Bluetooth → react-native-ble-plx
 *   WiFi      → Fujifilm Instax Share SDK or direct HTTP to the printer AP
 */

import { getConnectionMode, type ConnectionMode } from './config';

export type PrinterStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'printing'
  | 'error';

export interface PrinterDevice {
  id: string;
  name: string;
  mode: ConnectionMode;
  rssi?: number;   // Bluetooth signal strength
  ip?: string;     // WiFi direct IP
}

type StatusListener = (status: PrinterStatus) => void;

let _status: PrinterStatus = 'disconnected';
let _listeners: StatusListener[] = [];
let _connectedDevice: PrinterDevice | null = null;
let _mode: ConnectionMode = 'bluetooth';

function emit(s: PrinterStatus) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

// Mock device pools per mode
const BT_DEVICES: PrinterDevice[] = [
  { id: 'BT-LINK2-A1B2', name: 'INSTAX MINI Link 2',  mode: 'bluetooth', rssi: -58 },
  { id: 'BT-LINK-C3D4',  name: 'INSTAX MINI Link',    mode: 'bluetooth', rssi: -72 },
  { id: 'BT-SQ-E5F6',    name: 'INSTAX SQUARE Link',  mode: 'bluetooth', rssi: -80 },
];

const WIFI_DEVICES: PrinterDevice[] = [
  { id: 'WIFI-SP3-A1B2', name: 'INSTAX SHARE SP-3',  mode: 'wifi', ip: '192.168.0.1' },
  { id: 'WIFI-EVO-C3D4', name: 'INSTAX Mini EVO',    mode: 'wifi', ip: '192.168.0.1' },
];

export const InstaxPrinter = {
  getStatus(): PrinterStatus { return _status; },
  getMode(): ConnectionMode  { return _mode;   },
  getConnectedDevice(): PrinterDevice | null { return _connectedDevice; },

  onStatusChange(fn: StatusListener): () => void {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  async scan(): Promise<PrinterDevice[]> {
    _mode = await getConnectionMode();
    emit('scanning');
    // Simulate scan time: BT is faster than WiFi AP discovery
    await delay(_mode === 'bluetooth' ? 2000 : 3000);
    emit('disconnected');

    // In production:
    //   bluetooth → ble.startDeviceScan() filtering for Instax service UUIDs
    //   wifi      → scan for SSIDs matching /^INSTAX-/ or use mDNS on printer AP
    return _mode === 'bluetooth' ? BT_DEVICES : WIFI_DEVICES;
  },

  async connect(device: PrinterDevice): Promise<boolean> {
    _mode = device.mode;
    emit('connecting');
    await delay(device.mode === 'bluetooth' ? 2500 : 1800);
    _connectedDevice = device;
    emit('connected');
    return true;
  },

  async disconnect(): Promise<void> {
    _connectedDevice = null;
    emit('disconnected');
  },

  async printImage(imageUrl: string): Promise<boolean> {
    if (_status !== 'connected') throw new Error('Printer not connected');
    emit('printing');
    // Simulate ZINK thermal print ≈ 7–10 s
    await delay(8000);
    emit('connected');
    return true;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
