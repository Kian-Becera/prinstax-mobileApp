import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Canvas, Image as SkiaImage, useImage, ColorMatrix, Skia,
} from '@shopify/react-native-skia';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { connect, getStatus, print as printToInstax } from '../../src/lib/instaxPrinter';
import { logPrint } from '../../src/lib/firebase';
import { config } from '../../src/lib/config';

const TARGET_W = 600;
const TARGET_H = Math.round(TARGET_W * (62 / 46));

const hueRotation = (deg: number): number[] => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const lr = 0.213, lg = 0.715, lb = 0.072;
  return [
    lr + c * (1 - lr) + s * -lr, lg + c * -lg + s * -lg, lb + c * -lb + s * (1 - lb), 0, 0,
    lr + c * -lr + s * 0.143, lg + c * (1 - lg) + s * 0.140, lb + c * -lb + s * -0.283, 0, 0,
    lr + c * -lr + s * -(1 - lr), lg + c * -lg + s * lg, lb + c * (1 - lb) + s * lb, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

const saturationMatrix = (s: number): number[] => {
  const lr = 0.3086, lg = 0.6094, lb = 0.0820;
  const inv = 1 - s;
  return [
    lr * inv + s, lg * inv,     lb * inv,     0, 0,
    lr * inv,     lg * inv + s, lb * inv,     0, 0,
    lr * inv,     lg * inv,     lb * inv + s, 0, 0,
    0,            0,            0,            1, 0,
  ];
};

const luminanceMatrix = (l: number): number[] => [
  1, 0, 0, 0, l,
  0, 1, 0, 0, l,
  0, 0, 1, 0, l,
  0, 0, 0, 1, 0,
];

const multiply4x5 = (a: number[], b: number[]): number[] => {
  const out = new Array(20).fill(0) as number[];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[row * 5 + k] * b[k * 5 + col];
      if (col === 4) v += a[row * 5 + 4];
      out[row * 5 + col] = v;
    }
  }
  return out;
};

const composeMatrix = (h: number, s: number, l: number): number[] =>
  multiply4x5(luminanceMatrix(l), multiply4x5(saturationMatrix(s), hueRotation(h)));

export default function EditorScreen() {
  const { uri, sessionId, clientName } = useLocalSearchParams<{
    uri: string; sessionId?: string; clientName?: string;
  }>();
  const router = useRouter();
  const image = useImage(uri ?? null);

  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);
  const [lum, setLum] = useState(0);
  const [autoCrop, setAutoCrop] = useState(true);
  const [busy, setBusy] = useState(false);

  const matrix = useMemo(() => composeMatrix(hue, sat, lum), [hue, sat, lum]);

  const exportEdited = async (): Promise<string> => {
    if (!uri || !image) throw new Error('No image');

    let workUri = uri;
    if (autoCrop) {
      const meta = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const target = config.instaxAspectRatio;
      const { width, height } = meta;
      const currentRatio = height / width;
      const actions: ImageManipulator.Action[] = [];
      if (currentRatio > target) {
        const newH = Math.round(width * target);
        const offY = Math.round((height - newH) / 2);
        actions.push({ crop: { originX: 0, originY: offY, width, height: newH } });
      } else if (currentRatio < target) {
        const newW = Math.round(height / target);
        const offX = Math.round((width - newW) / 2);
        actions.push({ crop: { originX: offX, originY: 0, width: newW, height } });
      }
      const cropped = await ImageManipulator.manipulateAsync(uri, actions, {
        format: ImageManipulator.SaveFormat.JPEG, compress: 0.95,
      });
      workUri = cropped.uri;
    }

    const adjusted = hue !== 0 || sat !== 1 || lum !== 0;
    if (!adjusted) return workUri;

    const data = Skia.Data.fromBase64(
      await FileSystem.readAsStringAsync(workUri, { encoding: FileSystem.EncodingType.Base64 }),
    );
    const skImage = Skia.Image.MakeImageFromEncoded(data);
    if (!skImage) throw new Error('Could not decode image for filtering');

    const w = skImage.width();
    const h = skImage.height();
    const surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) throw new Error('Could not allocate offscreen surface');
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    canvas.drawImage(skImage, 0, 0, paint);

    const snapshot = surface.makeImageSnapshot();
    const b64 = snapshot.encodeToBase64();
    const outPath = `${FileSystem.cacheDirectory}edited-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 });
    return outPath;
  };

  const printNow = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      let s = await getStatus();
      if (s.state !== 'connected') s = await connect();
      if (s.state !== 'connected') {
        Alert.alert('Printer not connected', 'Open Settings to connect first.');
        return;
      }
      const finalUri = await exportEdited();
      await printToInstax(finalUri);
      if (sessionId) {
        await logPrint({
          sessionId, imageUrl: finalUri, thumbnailUrl: finalUri,
          clientName: clientName || undefined, printedAt: Date.now(), status: 'success',
        }).catch(() => {});
      }
      Alert.alert('Sent to printer', 'Edits applied and printed.');
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Print failed', msg);
    } finally {
      setBusy(false);
    }
  };

  if (!uri) return <View style={styles.root}><Text style={styles.empty}>No image.</Text></View>;
  if (!image) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator color="#5b8def" /></View>;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: TARGET_W / 2, height: TARGET_H / 2 }}>
          <SkiaImage image={image} fit="cover"
            x={0} y={0} width={TARGET_W / 2} height={TARGET_H / 2}>
            <ColorMatrix matrix={matrix} />
          </SkiaImage>
        </Canvas>
      </View>

      <SliderRow label={`Hue ${Math.round(hue)}°`} value={hue} min={-180} max={180} onChange={setHue} />
      <SliderRow label={`Saturation ${sat.toFixed(2)}`} value={sat} min={0} max={2} onChange={setSat} />
      <SliderRow label={`Lightness ${lum >= 0 ? '+' : ''}${(lum * 100).toFixed(0)}`} value={lum} min={-0.5} max={0.5} onChange={setLum} />

      <Pressable
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed, autoCrop && styles.toggleOn]}
        onPress={() => setAutoCrop(!autoCrop)}
      >
        <Text style={[styles.toggleText, autoCrop && styles.toggleTextOn]}>
          Auto-crop to Instax (62×46) {autoCrop ? '✓' : ''}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.printBtn, pressed && styles.pressed]}
        onPress={printNow} disabled={busy}
      >
        <Text style={styles.printText}>{busy ? 'Printing…' : 'Apply & print'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
        onPress={() => { setHue(0); setSat(1); setLum(0); }}
      >
        <Text style={styles.resetText}>Reset adjustments</Text>
      </Pressable>
    </ScrollView>
  );
}

function SliderRow({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const step = (max - min) / 40;
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderControls}>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${((value - min) / (max - min)) * 100}%` }]} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b10' },
  center: { justifyContent: 'center', alignItems: 'center' },
  canvasWrap: { alignItems: 'center', backgroundColor: '#000', borderRadius: 12, padding: 8, marginBottom: 16 },
  empty: { color: '#9b9bab', textAlign: 'center', marginTop: 40 },
  sliderRow: { marginBottom: 16 },
  sliderLabel: { color: '#cfd2dc', fontSize: 13, marginBottom: 6 },
  sliderControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#15151d', justifyContent: 'center', alignItems: 'center' },
  stepText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#23232f', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#5b8def' },
  toggle: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#23232f', alignItems: 'center', marginTop: 8 },
  toggleOn: { borderColor: '#5b8def', backgroundColor: '#101729' },
  toggleText: { color: '#9b9bab', fontWeight: '500' },
  toggleTextOn: { color: '#cfd2dc' },
  printBtn: { marginTop: 20, backgroundColor: '#5b8def', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  printText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resetBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  resetText: { color: '#9b9bab' },
  pressed: { opacity: 0.85 },
});
