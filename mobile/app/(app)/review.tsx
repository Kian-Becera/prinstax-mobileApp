import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { absoluteUrl, fetchServerSession, markSessionCompleted, ServerSession } from '../../src/lib/api';
import { connect, getStatus, print as printToInstax, InstaxStatus } from '../../src/lib/instaxPrinter';
import { logPrint } from '../../src/lib/firebase';
import { StatusPill } from '../../src/components/StatusPill';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<ServerSession | null>(null);
  const [printer, setPrinter] = useState<InstaxStatus>({ state: 'disconnected' });
  const [busyAll, setBusyAll] = useState(false);
  const [busyOne, setBusyOne] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const s = await fetchServerSession(id);
    setSession(s);
    setPrinter(await getStatus());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const ensureConnected = async (): Promise<boolean> => {
    let s = await getStatus();
    if (s.state !== 'connected') s = await connect();
    setPrinter(s);
    return s.state === 'connected';
  };

  const printOne = async (imageUrl: string) => {
    if (!session) return;
    setBusyOne(imageUrl);
    try {
      if (!(await ensureConnected())) {
        Alert.alert('Printer not connected', 'Open Settings to connect to the Instax.');
        return;
      }
      const fullUrl = absoluteUrl(imageUrl);
      await printToInstax(fullUrl);
      await logPrint({
        sessionId: session.id,
        imageUrl: fullUrl,
        thumbnailUrl: fullUrl,
        clientName: session.clientName,
        printedAt: Date.now(),
        status: 'success',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await logPrint({
        sessionId: session.id, imageUrl, printedAt: Date.now(),
        status: 'failed', errorMessage: msg, clientName: session.clientName,
      }).catch(() => {});
      Alert.alert('Print failed', msg);
    } finally {
      setBusyOne(null);
    }
  };

  const printAll = async () => {
    if (!session) return;
    setBusyAll(true);
    try {
      if (!(await ensureConnected())) {
        Alert.alert('Printer not connected', 'Open Settings to connect to the Instax.');
        return;
      }
      for (const img of session.imageUrls) {
        try {
          const full = absoluteUrl(img);
          await printToInstax(full);
          await logPrint({
            sessionId: session.id, imageUrl: full, thumbnailUrl: full,
            clientName: session.clientName, printedAt: Date.now(), status: 'success',
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          await logPrint({
            sessionId: session.id, imageUrl: img, printedAt: Date.now(),
            status: 'failed', errorMessage: msg, clientName: session.clientName,
          }).catch(() => {});
        }
      }
      await markSessionCompleted(session.id).catch(() => {});
      Alert.alert('Batch complete', 'All images sent to the printer.');
      router.back();
    } finally {
      setBusyAll(false);
    }
  };

  if (!session) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#5b8def" />
      </View>
    );
  }

  const tone = printer.state === 'connected' ? 'ok' : printer.state === 'error' ? 'bad' : 'idle';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{session.clientName ?? 'Client'}</Text>
          <Text style={styles.meta}>{session.clientDate ?? '—'} · {session.imageUrls.length} images</Text>
        </View>
        <StatusPill label={`Printer: ${printer.state}`} tone={tone} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.batchBtn, pressed && styles.pressed]}
        onPress={() => Alert.alert(
          'Print all?',
          `Print ${session.imageUrls.length} images now?`,
          [{ text: 'Cancel' }, { text: 'Print all', onPress: printAll }],
        )}
        disabled={busyAll || busyOne !== null}
      >
        <Text style={styles.batchText}>
          {busyAll ? 'Printing batch…' : `Approve & print all (${session.imageUrls.length})`}
        </Text>
      </Pressable>

      {session.imageUrls.map((img) => {
        const full = absoluteUrl(img);
        const busy = busyOne === img;
        return (
          <View key={img} style={styles.card}>
            <Image source={{ uri: full }} style={styles.image} resizeMode="cover" />
            <View style={styles.cardActions}>
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                onPress={() => router.push({
                  pathname: '/(app)/editor',
                  params: { uri: full, sessionId: session.id, clientName: session.clientName ?? '' },
                })}
              >
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
                onPress={() => printOne(img)}
                disabled={busy || busyAll}
              >
                <Text style={styles.actionPrimaryText}>{busy ? 'Printing…' : 'Print'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  meta: { color: '#9b9bab', marginTop: 4 },
  batchBtn: { backgroundColor: '#5b8def', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginVertical: 16 },
  batchText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: '#15151d', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 46 / 62, backgroundColor: '#000' },
  cardActions: { flexDirection: 'row', padding: 10, gap: 8 },
  action: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#23232f' },
  actionText: { color: '#cfd2dc', fontWeight: '500' },
  actionPrimary: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#5b8def' },
  actionPrimaryText: { color: '#fff', fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
