import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, RefreshControl, Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listPrintLogs, getDailyCount, PrintLogDoc } from '../../src/lib/firebase';
import { runCleanupNow } from '../../src/lib/cleanup';
import { StatusPill } from '../../src/components/StatusPill';

const fmt = (ts: number): string => new Date(ts).toLocaleString();

export default function HistoryScreen() {
  const [items, setItems] = useState<PrintLogDoc[]>([]);
  const [count, setCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [logs, c] = await Promise.all([
      listPrintLogs(100).catch(() => []),
      getDailyCount().catch(() => 0),
    ]);
    setItems(logs);
    setCount(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sweepNow = async () => {
    const removed = await runCleanupNow().catch(() => 0);
    await load();
    alertSimple(`Cleanup ran. Removed ${removed} session(s).`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <StatusPill label={`Today: ${count}`} tone="ok" />
        <Pressable style={({ pressed }) => [styles.cleanBtn, pressed && styles.pressed]} onPress={sweepNow}>
          <Text style={styles.cleanText}>Run cleanup now</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id ?? `${item.printedAt}-${item.imageUrl}`}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={<Text style={styles.empty}>No prints yet.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbMissing]}>
                <Text style={styles.thumbMissingText}>—</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.client}>{item.clientName ?? 'Client'}</Text>
              <Text style={styles.meta}>{fmt(item.printedAt)}</Text>
              {item.errorMessage && <Text style={styles.err}>{item.errorMessage}</Text>}
            </View>
            <StatusPill
              label={item.status === 'success' ? 'OK' : 'Failed'}
              tone={item.status === 'success' ? 'ok' : 'bad'}
            />
          </View>
        )}
      />
    </View>
  );
}

const alertSimple = (msg: string) => {
  // Light alert helper to keep the file slim
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Alert } = require('react-native');
  Alert.alert('Cleanup', msg);
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10' },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 12 },
  cleanBtn: { marginLeft: 'auto', borderColor: '#23232f', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  cleanText: { color: '#cfd2dc', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#15151d', borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  thumb: { width: 56, height: 76, borderRadius: 6, backgroundColor: '#000' },
  thumbMissing: { justifyContent: 'center', alignItems: 'center' },
  thumbMissingText: { color: '#444' },
  client: { color: '#fff', fontWeight: '600' },
  meta: { color: '#9b9bab', fontSize: 12, marginTop: 2 },
  err: { color: '#f08383', fontSize: 11, marginTop: 4 },
  empty: { color: '#6b6b7b', textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.85 },
});
