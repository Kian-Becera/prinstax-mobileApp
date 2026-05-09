import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listServerSessions, ServerSession } from '../../src/lib/api';
import { getDailyCount } from '../../src/lib/firebase';
import { getStatus, InstaxStatus } from '../../src/lib/instaxPrinter';
import { StatusPill } from '../../src/components/StatusPill';
import { useAuth } from '../../src/state/AuthContext';

export default function Dashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<ServerSession[]>([]);
  const [printer, setPrinter] = useState<InstaxStatus>({ state: 'disconnected' });
  const [count, setCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setServerError(null);
      const [s, c, p] = await Promise.all([
        listServerSessions().catch((e: Error) => {
          setServerError(`Server unreachable: ${e.message}`);
          return [] as ServerSession[];
        }),
        getDailyCount().catch(() => 0),
        getStatus(),
      ]);
      setSessions(s);
      setCount(c);
      setPrinter(p);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Load failed', msg);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const printerTone = printer.state === 'connected' || printer.state === 'printing'
    ? 'ok' : printer.state === 'error' ? 'bad' : 'idle';

  const pending = sessions.filter((s) => s.status === 'uploaded');
  const inProgress = sessions.filter((s) => s.status === 'reviewed');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <View style={styles.row}>
        <StatusPill label={`Printer: ${printer.state}`} tone={printerTone} />
        <StatusPill label={`Today: ${count}`} tone="ok" />
      </View>

      {serverError && (
        <View style={[styles.card, { borderColor: '#5d2a2a' }]}>
          <Text style={{ color: '#f08383' }}>{serverError}</Text>
          <Text style={{ color: '#9b9bab', marginTop: 4, fontSize: 12 }}>
            Check EXPO_PUBLIC_SERVER_URL and that the Express server is running.
          </Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => router.push('/(app)/qr')}
      >
        <Text style={styles.primaryText}>Generate QR for client</Text>
      </Pressable>

      <Section title={`Awaiting review (${pending.length})`}>
        {pending.length === 0 ? (
          <Text style={styles.empty}>No new uploads.</Text>
        ) : pending.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push({ pathname: '/(app)/review', params: { id: s.id } })}
            style={({ pressed }) => [styles.row2, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{s.clientName ?? 'Client'}</Text>
              <Text style={styles.itemMeta}>
                {s.imageUrls.length} image{s.imageUrls.length === 1 ? '' : 's'} · {s.clientDate ?? '—'}
              </Text>
            </View>
            <StatusPill label="Uploaded" tone="warn" />
          </Pressable>
        ))}
      </Section>

      <Section title={`In progress (${inProgress.length})`}>
        {inProgress.length === 0 ? (
          <Text style={styles.empty}>None.</Text>
        ) : inProgress.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push({ pathname: '/(app)/review', params: { id: s.id } })}
            style={({ pressed }) => [styles.row2, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{s.clientName ?? 'Client'}</Text>
              <Text style={styles.itemMeta}>{s.imageUrls.length} images</Text>
            </View>
            <StatusPill label="Reviewing" tone="ok" />
          </Pressable>
        ))}
      </Section>

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/history')}
        >
          <Text style={styles.tileText}>Print history</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/settings')}
        >
          <Text style={styles.tileText}>Settings</Text>
        </Pressable>
      </View>

      <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10' },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#15151d', padding: 14, borderRadius: 12 },
  card: { backgroundColor: '#15151d', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#23232f' },
  primary: { marginTop: 16, backgroundColor: '#5b8def', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  sectionTitle: { color: '#9b9bab', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemMeta: { color: '#9b9bab', fontSize: 12, marginTop: 2 },
  empty: { color: '#6b6b7b', fontStyle: 'italic', padding: 8 },
  tile: { flex: 1, backgroundColor: '#15151d', padding: 18, borderRadius: 12, alignItems: 'center' },
  tileText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  logout: { marginTop: 24, padding: 14, alignItems: 'center' },
  logoutText: { color: '#9b9bab' },
});
