import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { buildClientUploadUrl, createServerSession } from '../../src/lib/api';
import { createSession } from '../../src/lib/firebase';

const newId = (): string => {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `s_${Date.now().toString(36)}_${rnd}`;
};

export default function QRScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const id = newId();
      await createServerSession(id);
      await createSession(id).catch(() => {});
      setSessionId(id);
      setUrl(buildClientUploadUrl(id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not start session', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generate(); }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.help}>
        Have the client scan this code with their phone camera. They&apos;ll upload up to 5 photos.
      </Text>

      <View style={styles.qrBox}>
        {loading || !url ? (
          <ActivityIndicator color="#5b8def" />
        ) : (
          <QRCode value={url} size={240} backgroundColor="#fff" color="#000" />
        )}
      </View>

      {url && (
        <>
          <Text style={styles.url} selectable>{url}</Text>
          <Text style={styles.sessionId}>Session: {sessionId}</Text>
        </>
      )}

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={generate}
          disabled={loading}
        >
          <Text style={styles.btnText}>New QR</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
          onPress={() => url && Share.share({ message: url })}
          disabled={!url}
        >
          <Text style={styles.btnGhostText}>Share link</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10', alignItems: 'center', padding: 24 },
  help: { color: '#9b9bab', textAlign: 'center', marginTop: 8, marginBottom: 24, fontSize: 14 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, minHeight: 280, minWidth: 280, alignItems: 'center', justifyContent: 'center' },
  url: { color: '#cfd2dc', marginTop: 16, fontSize: 13 },
  sessionId: { color: '#6b6b7b', marginTop: 6, fontSize: 11 },
  row: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { backgroundColor: '#5b8def', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhost: { borderWidth: 1, borderColor: '#23232f', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  btnGhostText: { color: '#cfd2dc' },
  pressed: { opacity: 0.85 },
});
