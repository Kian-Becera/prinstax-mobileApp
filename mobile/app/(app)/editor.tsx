import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { getSession, processImage, type ImageEntry, type Session } from '../../src/lib/api';

interface HSL { hue: number; saturation: number; lightness: number }

export default function EditorScreen() {
  const { sessionId, imageId } = useLocalSearchParams<{ sessionId: string; imageId: string }>();
  const [session, setSession]   = useState<Session | null>(null);
  const [image, setImage]       = useState<ImageEntry | null>(null);
  const [hsl, setHsl]           = useState<HSL>({ hue: 0, saturation: 0, lightness: 0 });
  const [previewUri, setPreviewUri] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied]   = useState(false);

  useEffect(() => {
    if (!sessionId || !imageId) return;
    getSession(sessionId).then(s => {
      setSession(s);
      const img = s.images.find(i => i.id === imageId);
      if (img) {
        setImage(img);
        setHsl(img.hsl ?? { hue: 0, saturation: 0, lightness: 0 });
        setPreviewUri(img.processedUrl ?? img.downloadUrl);
      }
    });
  }, [sessionId, imageId]);

  async function handleApply() {
    if (!session || !image) return;
    setApplying(true);
    try {
      const res = await processImage(session.id, image.id, hsl, null);
      setPreviewUri(`${res.processedUrl}?t=${Date.now()}`);
      setApplied(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setApplying(false);
    }
  }

  function handleReset() {
    setHsl({ hue: 0, saturation: 0, lightness: 0 });
    if (image) setPreviewUri(image.downloadUrl);
    setApplied(false);
  }

  if (!image) {
    return (
      <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
        <ActivityIndicator color="#F97316" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0A0A0A]">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 gap-3">
        <TouchableOpacity onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-card items-center justify-center">
          <Text className="text-white text-base">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">Edit Photo</Text>
          <Text className="text-neutral-500 text-xs">{session?.client?.name}</Text>
        </View>
        {applied && (
          <View className="px-2 py-1 rounded-lg bg-teal-500/20">
            <Text className="text-teal-400 text-xs font-semibold">Saved</Text>
          </View>
        )}
      </View>

      {/* Image preview */}
      <View className="mx-5 rounded-2xl overflow-hidden bg-card" style={{ aspectRatio: 62 / 46 }}>
        {applying ? (
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator color="#F97316" size="large" />
            <Text className="text-neutral-400 text-xs">Applying edits…</Text>
          </View>
        ) : (
          <Image source={{ uri: previewUri }} className="w-full h-full" resizeMode="cover" key={previewUri} />
        )}
        <View className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/50">
          <Text className="text-white text-xs font-medium">62×46mm</Text>
        </View>
      </View>

      {/* Controls */}
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 20 }}>
        <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase mb-4">Adjustments</Text>

        <SliderRow label="Hue"        value={hsl.hue}        min={-180} max={180} step={1}
          format={v => `${v > 0 ? '+' : ''}${v}°`}
          onChange={v => { setHsl(p => ({ ...p, hue: v })); setApplied(false); }} />
        <SliderRow label="Saturation" value={hsl.saturation} min={-100} max={100} step={1}
          format={v => `${v > 0 ? '+' : ''}${v}%`}
          onChange={v => { setHsl(p => ({ ...p, saturation: v })); setApplied(false); }} />
        <SliderRow label="Brightness" value={hsl.lightness}  min={-100} max={100} step={1}
          format={v => `${v > 0 ? '+' : ''}${v}%`}
          onChange={v => { setHsl(p => ({ ...p, lightness: v })); setApplied(false); }} />

        <View className="mt-4 bg-card rounded-xl p-3 flex-row items-center gap-2">
          <Text style={{ fontSize: 16 }}>✂️</Text>
          <Text className="text-neutral-400 text-xs flex-1">
            Auto-crop to Instax Mini ratio (62×46mm) is applied on every process.
          </Text>
        </View>

        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity onPress={handleReset}
            className="flex-1 py-4 bg-card rounded-2xl items-center">
            <Text className="text-neutral-400 font-semibold text-sm">Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApply} disabled={applying}
            className="flex-1 py-4 bg-orange-500 rounded-2xl items-center disabled:opacity-40">
            <Text className="text-white font-semibold text-sm">
              {applying ? 'Applying…' : 'Apply Edits'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <View className="mb-5">
      <View className="flex-row justify-between mb-1">
        <Text className="text-neutral-300 text-sm font-medium">{label}</Text>
        <Text className="text-orange-400 text-sm font-semibold tabular-nums">{format(value)}</Text>
      </View>
      <Slider
        minimumValue={min} maximumValue={max} step={step} value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#F97316" maximumTrackTintColor="#2A2A2A" thumbTintColor="#F97316"
      />
    </View>
  );
}
