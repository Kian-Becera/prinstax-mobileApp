import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  getConnectionMode, setConnectionMode,
  getPrinterIp, setPrinterIp,
  type ConnectionMode,
} from '../../src/lib/config';
import { InstaxPrinter, type PrinterStatus, type PrinterDevice } from '../../src/lib/instaxPrinter';
import { useAuth } from '../../src/state/AuthContext';
import StatusPill from '../../src/components/StatusPill';

async function checkPrinterIp(ip: string): Promise<boolean> {
  try {
    await fetch(`http://${ip}`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch (e: any) {
    const msg = (e?.message ?? '').toLowerCase();
    return msg.includes('refused') || msg.includes('econnrefused');
  }
}

export default function SettingsScreen() {
  const { logout, user } = useAuth();

  // ── Printer ───────────────────────────────────────────────────────────────
  const [connMode, setConnModeState]           = useState<ConnectionMode>('bluetooth');
  const [printerIp, setPrinterIpState]         = useState('');
  const [printerStatus, setPrinterStatus]      = useState<PrinterStatus>(InstaxPrinter.getStatus());
  const [devices, setDevices]                  = useState<PrinterDevice[]>([]);
  const [scanning, setScanning]                = useState(false);
  const [scanDone, setScanDone]                = useState(false);
  const [connectedDevice, setConnectedDevice]  = useState<PrinterDevice | null>(InstaxPrinter.getConnectedDevice());
  const [checkingIp, setCheckingIp]            = useState(false);
  const [ipReachable, setIpReachable]          = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([getConnectionMode(), getPrinterIp()]).then(([mode, ip]) => {
      setConnModeState(mode);
      setPrinterIpState(ip);
    });
    return InstaxPrinter.onStatusChange(s => {
      setPrinterStatus(s);
      setConnectedDevice(InstaxPrinter.getConnectedDevice());
    });
  }, []);

  async function switchMode(mode: ConnectionMode) {
    setConnModeState(mode);
    await setConnectionMode(mode);
    setDevices([]);
    setScanDone(false);
    setIpReachable(null);
    if (connectedDevice) await InstaxPrinter.disconnect();
  }

  async function scanForDevices() {
    setScanning(true); setScanDone(false); setDevices([]);
    try { setDevices(await InstaxPrinter.scan()); }
    finally { setScanning(false); setScanDone(true); }
  }

  async function connectDevice(device: PrinterDevice) {
    try { await InstaxPrinter.connect(device); }
    catch (e: any) { Alert.alert('Connection Failed', e.message); }
  }

  async function handleCheckPrinterIp() {
    const ip = printerIp.trim();
    if (!ip) return;
    await setPrinterIp(ip);
    setCheckingIp(true); setIpReachable(null);
    setIpReachable(await checkPrinterIp(ip));
    setCheckingIp(false);
  }

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  }

  const printerStatusVariant = (
    { connected: 'connected', disconnected: 'disconnected', scanning: 'pending',
      connecting: 'pending', printing: 'printing', error: 'error' } as Record<PrinterStatus, any>
  )[printerStatus];

  return (
    <ScrollView className="flex-1 bg-[#0A0A0A]" contentContainerStyle={{ paddingBottom: 60 }}>

      {/* Header */}
      <View className="px-5 pt-14 pb-4">
        <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase">Admin</Text>
        <Text className="text-white text-2xl font-bold mt-0.5">Settings</Text>
        {user?.email ? (
          <Text className="text-neutral-600 text-xs mt-1">{user.email}</Text>
        ) : null}
      </View>

      {/* ── Instax Printer ────────────────────────────────── */}
      <Section title="Instax Printer">

        {/* Mode toggle */}
        <View className="flex-row gap-2 mb-4">
          {(['bluetooth', 'wifi'] as ConnectionMode[]).map(mode => (
            <TouchableOpacity key={mode} onPress={() => switchMode(mode)}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2
                ${connMode === mode ? 'bg-orange-500' : 'bg-[#0A0A0A] border border-border'}`}>
              <Text style={{ fontSize: 16 }}>{mode === 'bluetooth' ? '🔵' : '📡'}</Text>
              <Text className={`text-sm font-semibold ${connMode === mode ? 'text-white' : 'text-neutral-500'}`}>
                {mode === 'bluetooth' ? 'Bluetooth' : 'Wi-Fi'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* WiFi mode */}
        {connMode === 'wifi' && (
          <View className="mb-4 gap-3">
            <Text className="text-neutral-500 text-xs">
              Printer IP (usually <Text className="text-orange-400">192.168.0.1</Text> on the printer's AP)
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={printerIp}
                onChangeText={v => { setPrinterIpState(v); setIpReachable(null); }}
                autoCapitalize="none" autoCorrect={false} keyboardType="decimal-pad"
                placeholder="192.168.0.1" placeholderTextColor="#4B5563"
                className="flex-1 bg-[#0A0A0A] border border-border rounded-xl px-4 py-3 text-white text-sm"
              />
              <TouchableOpacity onPress={handleCheckPrinterIp} disabled={checkingIp || !printerIp.trim()}
                className="px-4 py-3 bg-orange-500 rounded-xl items-center justify-center disabled:opacity-50">
                {checkingIp
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text className="text-white text-sm font-semibold">Check</Text>
                }
              </TouchableOpacity>
            </View>
            {ipReachable !== null && (
              <View className={`px-3 py-2 rounded-xl ${ipReachable ? 'bg-teal-500/10' : 'bg-red-500/10'}`}>
                <Text className={`text-xs ${ipReachable ? 'text-teal-400' : 'text-red-400'}`}>
                  {ipReachable
                    ? `✓ ${printerIp} is reachable — printer AP detected`
                    : `✗ ${printerIp} is unreachable — make sure you're on the printer's Wi-Fi`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bluetooth note */}
        {connMode === 'bluetooth' && (
          <View className="mb-3 bg-[#0A0A0A] rounded-xl px-3 py-2.5">
            <Text className="text-neutral-500 text-xs">
              Bluetooth scanning searches for nearby Instax devices.
              {'\n'}Real BLE requires a <Text className="text-orange-400">custom dev build</Text> — Expo Go uses a simulation.
            </Text>
          </View>
        )}

        {/* Connected device */}
        {connectedDevice && (
          <View className="flex-row items-center justify-between bg-[#0A0A0A] rounded-xl px-4 py-3 mb-3">
            <View>
              <Text className="text-white font-medium text-sm">{connectedDevice.name}</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {connectedDevice.mode === 'bluetooth'
                  ? `Bluetooth · RSSI ${connectedDevice.rssi} dBm`
                  : `Wi-Fi · ${connectedDevice.ip}`}
              </Text>
            </View>
            <StatusPill variant={printerStatusVariant} />
          </View>
        )}

        {/* Scan / disconnect */}
        {printerStatus === 'connected' ? (
          <TouchableOpacity onPress={() => InstaxPrinter.disconnect()}
            className="py-3 bg-neutral-800 rounded-xl items-center">
            <Text className="text-neutral-400 font-semibold text-sm">Disconnect Printer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={scanForDevices}
            disabled={scanning || printerStatus === 'connecting'}
            className="py-3 bg-orange-500 rounded-xl items-center flex-row justify-center gap-2 disabled:opacity-50">
            {scanning || printerStatus === 'connecting'
              ? <>
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white font-semibold text-sm">
                    {printerStatus === 'connecting' ? 'Connecting…' : connMode === 'bluetooth' ? 'Scanning Bluetooth…' : 'Scanning Wi-Fi…'}
                  </Text>
                </>
              : <Text className="text-white font-semibold text-sm">
                  {connMode === 'bluetooth' ? '🔵  Scan for Bluetooth Devices' : '📡  Scan Wi-Fi Network'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* Device list */}
        {devices.length > 0 && (
          <View className="mt-3 gap-2">
            <Text className="text-neutral-500 text-xs uppercase tracking-wider">
              {devices.length} device{devices.length !== 1 ? 's' : ''} found
            </Text>
            {devices.map(d => (
              <TouchableOpacity key={d.id} onPress={() => connectDevice(d)}
                disabled={printerStatus === 'connecting'}
                className="flex-row items-center bg-[#0A0A0A] px-4 py-3 rounded-xl gap-3">
                <Text style={{ fontSize: 20 }}>🖨️</Text>
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">{d.name}</Text>
                  <Text className="text-neutral-600 text-xs">
                    {d.mode === 'bluetooth' ? `${d.rssi} dBm` : d.ip}
                  </Text>
                </View>
                {printerStatus === 'connecting'
                  ? <ActivityIndicator color="#F97316" size="small" />
                  : <Text className="text-orange-500 text-sm font-semibold">Connect →</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* No devices found */}
        {scanDone && devices.length === 0 && (
          <View className="mt-3 bg-[#0A0A0A] rounded-2xl p-4 gap-3">
            <View className="items-center gap-1 py-1">
              <Text className="text-3xl">🔍</Text>
              <Text className="text-neutral-300 font-semibold text-sm">No devices found</Text>
            </View>
            {connMode === 'bluetooth' ? (
              <View className="gap-1.5">
                <Text className="text-neutral-600 text-xs">• Enable Bluetooth on your phone</Text>
                <Text className="text-neutral-600 text-xs">• Power on the Instax printer</Text>
                <Text className="text-neutral-600 text-xs">• Hold the power button to enter pairing mode</Text>
                <Text className="text-neutral-600 text-xs">• Keep the printer within 5 metres</Text>
              </View>
            ) : (
              <View className="gap-1.5">
                <Text className="text-neutral-600 text-xs">• Go to your phone's Wi-Fi settings</Text>
                <Text className="text-neutral-600 text-xs">• Connect to <Text className="text-orange-400">INSTAX-XXXXXX</Text> AP</Text>
                <Text className="text-neutral-600 text-xs">• Return here and enter <Text className="text-orange-400">192.168.0.1</Text></Text>
                <Text className="text-neutral-600 text-xs">• Tap Check to verify connectivity</Text>
              </View>
            )}
            <TouchableOpacity onPress={scanForDevices} className="py-2.5 bg-card rounded-xl items-center mt-1">
              <Text className="text-neutral-300 font-semibold text-sm">Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </Section>

      {/* ── Account ──────────────────────────────────────────── */}
      <Section title="Account">
        <Row label="Signed in as" value={user?.displayName ?? user?.email ?? '—'} />
        <Row label="Auth provider" value="GitHub" />
      </Section>

      {/* ── About ────────────────────────────────────────────── */}
      <Section title="About">
        <Row label="App"          value="PrintStax v1.0.0" />
        <Row label="Backend"      value="Firebase (Firestore + Storage)" />
        <Row label="Print target" value="Instax Mini 62×46mm" />
        <Row label="Image TTL"    value="24 h auto-delete" />
      </Section>

      {/* Log out */}
      <View className="px-5 mt-2">
        <TouchableOpacity onPress={handleLogout}
          className="py-4 rounded-2xl border border-red-500/30 items-center">
          <Text className="text-red-400 font-semibold text-sm">Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mb-5">
      <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase mb-3">{title}</Text>
      <View className="bg-card rounded-2xl p-4">{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border last:border-0">
      <Text className="text-neutral-400 text-sm">{label}</Text>
      <Text className="text-neutral-500 text-sm">{value}</Text>
    </View>
  );
}
