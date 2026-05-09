import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Share, ScrollView,
} from 'react-native';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import { router } from 'expo-router';
import { createSession, deleteSession } from '../../src/lib/api';

interface ActiveSession { id: string; url: string }
type Step = 'idle' | 'generating' | 'ready' | 'error';

function QRImage({ value }: { value: string }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    QRCode.toString(value, {
      type: 'svg',
      margin: 2,
      width: 220,
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    })
      .then(setSvg)
      .catch(console.error);
  }, [value]);

  if (!svg) return <ActivityIndicator color="#F97316" />;
  return <SvgXml xml={svg} width={220} height={220} />;
}

export default function QRScreen() {
  const [step, setStep]         = useState<Step>('idle');
  const [session, setSession]   = useState<ActiveSession | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function generate() {
    setStep('generating');
    setErrorMsg('');
    if (session) await deleteSession(session.id).catch(() => {});
    try {
      const s = await createSession();
      setSession(s);
      setStep('ready');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to create session.');
      setStep('error');
    }
  }

  async function handleShare() {
    if (!session) return;
    await Share.share({ message: `Scan to upload your photos: ${session.url}`, url: session.url });
  }

  async function handleDiscard() {
    if (!session) return;
    await deleteSession(session.id).catch(() => {});
    setSession(null);
    setStep('idle');
  }

  return (
    <ScrollView className="flex-1 bg-[#0A0A0A]" contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View className="px-5 pt-14 pb-6">
        <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase">Admin</Text>
        <Text className="text-white text-2xl font-bold mt-0.5">QR Code</Text>
        <Text className="text-neutral-500 text-sm mt-1">Single-use · Expires after 24 hours</Text>
      </View>

      {/* ── Idle ─────────────────────────────────────────────── */}
      {step === 'idle' && (
        <View className="items-center px-5 gap-5 py-6">
          <View className="w-44 h-44 bg-card rounded-3xl items-center justify-center">
            <Text className="text-7xl opacity-20">⬛</Text>
          </View>
          <Text className="text-neutral-500 text-sm text-center max-w-xs">
            Generate a QR code and show it to your client — they scan it to upload their photos.
          </Text>
          <TouchableOpacity onPress={generate} className="px-12 py-4 bg-orange-500 rounded-2xl">
            <Text className="text-white font-bold text-base">Generate QR Code</Text>
          </TouchableOpacity>
          <Text className="text-neutral-700 text-xs text-center max-w-xs">
            Photos are stored on Firebase and auto-deleted after 24 h.
          </Text>
        </View>
      )}

      {/* ── Error ────────────────────────────────────────────── */}
      {step === 'error' && (
        <View className="px-5 gap-5 py-6">
          <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 gap-3">
            <Text className="text-red-400 text-sm font-semibold">Failed to Create Session</Text>
            <Text className="text-red-300 text-xs leading-relaxed">{errorMsg}</Text>
            <View className="gap-2 mt-1">
              <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Check</Text>
              <Text className="text-neutral-400 text-xs">1. Firebase project is configured correctly</Text>
              <Text className="text-neutral-400 text-xs">2. EXPO_PUBLIC_* environment variables are set</Text>
              <Text className="text-neutral-400 text-xs">3. You are signed in</Text>
            </View>
            <View className="flex-row gap-2 mt-1">
              <TouchableOpacity onPress={() => router.push('/(app)/settings')}
                className="flex-1 py-3 bg-neutral-800 rounded-xl items-center">
                <Text className="text-neutral-300 font-semibold text-sm">⚙️  Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={generate}
                className="flex-1 py-3 bg-orange-500 rounded-xl items-center">
                <Text className="text-white font-semibold text-sm">Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Generating ───────────────────────────────────────── */}
      {step === 'generating' && (
        <View className="items-center py-20 gap-4">
          <ActivityIndicator color="#F97316" size="large" />
          <Text className="text-neutral-500 text-sm">Creating session…</Text>
        </View>
      )}

      {/* ── Ready ────────────────────────────────────────────── */}
      {step === 'ready' && session && (
        <View className="items-center px-5 gap-5">

          {/* QR card — white background so the dark QR is scannable */}
          <View className="bg-white p-5 rounded-3xl shadow-lg items-center justify-center" style={{ minWidth: 252, minHeight: 252 }}>
            <QRImage value={session.url} />
          </View>

          {/* Status info */}
          <View className="bg-card rounded-2xl p-4 w-full gap-2">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-teal-400" />
              <Text className="text-teal-400 text-xs font-semibold">Active — waiting for client scan</Text>
            </View>
            <Text className="text-neutral-500 text-xs" numberOfLines={2}>{session.url}</Text>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity onPress={handleShare}
              className="flex-1 py-4 bg-card rounded-2xl items-center">
              <Text className="text-white font-semibold text-sm">Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={generate}
              className="flex-1 py-4 bg-orange-500 rounded-2xl items-center">
              <Text className="text-white font-semibold text-sm">New QR</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleDiscard} className="py-2">
            <Text className="text-neutral-600 text-sm">Discard this session</Text>
          </TouchableOpacity>

          {/* How it works */}
          <View className="bg-card rounded-2xl p-4 w-full gap-2">
            <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">How it works</Text>
            {[
              '1. Show this QR to your client',
              '2. They scan and upload 1–5 photos',
              '3. You get an instant notification',
              '4. Review → Edit → Approve → Print',
            ].map(s => (
              <Text key={s} className="text-neutral-600 text-xs">{s}</Text>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
