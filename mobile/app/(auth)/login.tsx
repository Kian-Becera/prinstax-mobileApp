import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../src/state/AuthContext';
import { getBiometricCapabilities, BiometricCapabilities } from '../../src/lib/auth';

export default function LoginScreen() {
  const { loginPassword, loginBiometric, biometricEnabled } = useAuth();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('admin');
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState<BiometricCapabilities | null>(null);

  useEffect(() => {
    getBiometricCapabilities().then(setCaps).catch(() => setCaps(null));
    if (biometricEnabled) {
      loginBiometric().catch(() => {});
    }
  }, []);

  const submit = async () => {
    setBusy(true);
    const ok = await loginPassword(u.trim(), p);
    setBusy(false);
    if (!ok) Alert.alert('Incorrect credentials', 'Default is admin / admin.');
  };

  const tryBio = async () => {
    setBusy(true);
    const ok = await loginBiometric();
    setBusy(false);
    if (!ok) Alert.alert('Biometric sign-in failed', 'Use your password.');
  };

  const bioLabel = (() => {
    if (!caps) return 'Biometrics';
    if (caps.faceId && caps.fingerprint) return 'Face / Fingerprint';
    if (caps.faceId) return 'Face ID';
    if (caps.fingerprint) return 'Fingerprint';
    return 'Biometrics';
  })();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Prinstax</Text>
        <Text style={styles.subtitle}>Admin sign in</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={u} onChangeText={setU}
          autoCapitalize="none" autoCorrect={false}
          style={styles.input} placeholderTextColor="#666"
          placeholder="admin"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={p} onChangeText={setP} secureTextEntry
          style={styles.input} placeholderTextColor="#666"
          placeholder="••••••"
        />

        <Pressable
          onPress={submit} disabled={busy}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        {caps?.hardwareAvailable && caps.enrolled && (
          <Pressable
            onPress={tryBio} disabled={busy}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnSecondaryText}>Use {bioLabel}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#15151d', borderRadius: 16, padding: 24, gap: 8 },
  title: { color: '#fff', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#9b9bab', fontSize: 14, marginBottom: 16 },
  label: { color: '#b8b8c8', fontSize: 12, marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#0b0b10', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#23232f' },
  btn: { marginTop: 20, backgroundColor: '#5b8def', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnPressed: { opacity: 0.85 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { marginTop: 10, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#23232f' },
  btnSecondaryText: { color: '#cfd2dc', fontSize: 15, fontWeight: '500' },
});
