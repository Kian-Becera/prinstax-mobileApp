import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as Network from 'expo-network';
import { useFocusEffect } from 'expo-router';
import {
  scanForDevices, connect, disconnect, getStatus, isNativeBacked, InstaxStatus,
} from '../../src/lib/instaxPrinter';
import { StatusPill } from '../../src/components/StatusPill';
import { useAuth } from '../../src/state/AuthContext';
import { getBiometricCapabilities } from '../../src/lib/auth';
import { config } from '../../src/lib/config';

interface NetState {
  type?: string;
  isConnected: boolean;
  ipAddress?: string;
}

export default function SettingsScreen() {
  const { biometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const [printer, setPrinter] = useState<InstaxStatus>({ state: 'disconnected' });
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<{ id: string; name: string; rssi: number }[]>([]);
  const [net, setNet] = useState<NetState>({ isConnected: false });
  const [bioCaps, setBioCaps] = useState<{ faceId: boolean; fingerprint: boolean; enrolled: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const [s, ns, ip, caps] = await Promise.all([
      getStatus(),
      Network.getNetworkStateAsync(),
      Network.getIpAddressAsync().catch(() => undefined),
      getBiometricCapabilities(),
    ]);
    setPrinter(s);
    setNet({
      isConnected: ns.isConnected ?? false,
      type: ns.type ? String(ns.type) : undefined,
      ipAddress: ip,
    });
    setBioCaps(caps);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  const scan = async () => {
    setScanning(true);
    try { setDevices(await scanForDevices(4000)); }
    catch (e: unknown) {
      Alert.alert('Scan failed', e instanceof Error ? e.message : String(e));
    }
    finally { setScanning(false); }
  };

  const connectTo = async (id: string) => {
    const s = await connect(id).catch((e: Error) => {
      Alert.alert('Connect failed', e.message);
      return null;
    });
    if (s) setPrinter(s);
  };

  const dropConnection = async () => {
    setPrinter(await disconnect());
  };

  const printerTone = printer.state === 'connected' ? 'ok'
    : printer.state === 'error' ? 'bad'
    : printer.state === 'connecting' ? 'warn' : 'idle';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <Section title="Network">
        <Row label="Status" value={net.isConnected ? 'Connected' : 'Offline'} tone={net.isConnected ? 'ok' : 'bad'} />
        <Row label="Type" value={net.type ?? 'Unknown'} />
        <Row label="IP address" value={net.ipAddress ?? '—'} />
        <Text style={styles.help}>Server URL: {config.serverUrl}</Text>
      </Section>

      <Section title="Instax printer">
        <Row label="State" value={printer.state} tone={printerTone} />
        {printer.deviceName && <Row label="Device" value={printer.deviceName} />}
        {printer.batteryLevel !== undefined && <Row label="Battery" value={`${Math.round(printer.batteryLevel * 100)}%`} />}
        {printer.filmRemaining !== undefined && <Row label="Film left" value={`${printer.filmRemaining}`} />}
        {!isNativeBacked() && (
          <Text style={styles.warn}>Native module not loaded — using mock printer.</Text>
        )}

        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={scan} disabled={scanning}>
          <Text style={styles.btnText}>{scanning ? 'Scanning…' : 'Scan for printers'}</Text>
        </Pressable>

        {scanning && <ActivityIndicator color="#5b8def" style={{ marginTop: 12 }} />}

        {devices.map((d) => (
          <Pressable key={d.id} style={({ pressed }) => [styles.deviceRow, pressed && styles.pressed]} onPress={() => connectTo(d.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.deviceId}>{d.id} · {d.rssi} dBm</Text>
            </View>
            <Text style={styles.connectLabel}>Connect</Text>
          </Pressable>
        ))}

        {printer.state === 'connected' && (
          <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]} onPress={dropConnection}>
            <Text style={styles.btnGhostText}>Disconnect</Text>
          </Pressable>
        )}
      </Section>

      <Section title="Biometrics">
        <Row label="Hardware" value={bioCaps?.enrolled ? 'Enrolled' : 'Not enrolled'} tone={bioCaps?.enrolled ? 'ok' : 'warn'} />
        <Row label="Face ID" value={bioCaps?.faceId ? 'Yes' : 'No'} />
        <Row label="Fingerprint" value={bioCaps?.fingerprint ? 'Yes' : 'No'} />
        {biometricEnabled ? (
          <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]} onPress={disableBiometric}>
            <Text style={styles.btnGhostText}>Disable biometric sign-in</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={enableBiometric}>
            <Text style={styles.btnText}>Enable biometric sign-in</Text>
          </Pressable>
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'idle' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {tone ? <StatusPill label={value} tone={tone} /> : <Text style={styles.rowValue}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10' },
  sectionTitle: { color: '#9b9bab', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  card: { backgroundColor: '#15151d', borderRadius: 12, padding: 14, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { color: '#9b9bab', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  help: { color: '#6b6b7b', fontSize: 12, marginTop: 8 },
  warn: { color: '#f0c969', fontSize: 12, marginTop: 8 },
  btn: { marginTop: 12, backgroundColor: '#5b8def', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhost: { marginTop: 12, borderWidth: 1, borderColor: '#23232f', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnGhostText: { color: '#cfd2dc' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#23232f', marginTop: 8 },
  deviceName: { color: '#fff', fontWeight: '500' },
  deviceId: { color: '#6b6b7b', fontSize: 11, marginTop: 2 },
  connectLabel: { color: '#5b8def', fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
