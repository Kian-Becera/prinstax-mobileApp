import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type Tone = 'ok' | 'warn' | 'bad' | 'idle';

const toneColor: Record<Tone, { bg: string; fg: string }> = {
  ok:   { bg: '#163d2c', fg: '#7ee2a8' },
  warn: { bg: '#3d3416', fg: '#f0c969' },
  bad:  { bg: '#3d1616', fg: '#f08383' },
  idle: { bg: '#1f1f28', fg: '#9b9bab' },
};

export function StatusPill({ label, tone = 'idle' }: { label: string; tone?: Tone }) {
  const c = toneColor[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
