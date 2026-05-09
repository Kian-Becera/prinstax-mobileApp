import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Alert,
  RefreshControl, ActivityIndicator, FlatList, Modal,
  Dimensions, Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  getSessions, approveImages, deleteSession, type Session, type ImageEntry,
} from '../../src/lib/api';
import { logPrint } from '../../src/lib/api';
import { InstaxPrinter } from '../../src/lib/instaxPrinter';
import { formatTTL } from '../../src/lib/cleanup';
import StatusPill from '../../src/components/StatusPill';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 40;

interface DateGroup { label: string; sessions: Session[] }

function groupByDate(sessions: Session[]): DateGroup[] {
  const map = new Map<string, Session[]>();
  sessions.forEach(s => {
    const ts = s.client?.date ? new Date(s.client.date).getTime() : s.createdAt;
    const d     = new Date(ts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
    let label: string;
    if (d >= today)     label = 'Today';
    else if (d >= yest) label = 'Yesterday';
    else                label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  });
  return Array.from(map.entries()).map(([label, sessions]) => ({ label, sessions }));
}

export default function ReviewScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [previewVisible, setPreviewVisible]   = useState(false);
  const [previewImages, setPreviewImages]     = useState<ImageEntry[]>([]);
  const [previewIndex, setPreviewIndex]       = useState(0);
  const [previewSession, setPreviewSession]   = useState<Session | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const s = await getSessions();
      setSessions(s.filter(s => ['pending', 'approved'].includes(s.status)));
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchSessions(); }, [fetchSessions]));
  const onRefresh = async () => { setRefreshing(true); await fetchSessions(); setRefreshing(false); };

  function openPreview(session: Session, index: number) {
    setPreviewSession(session);
    setPreviewImages(session.images);
    setPreviewIndex(index);
    setPreviewVisible(true);
  }

  async function handleBatchApprove(session: Session) {
    try {
      await approveImages(session.id, 'all');
      await fetchSessions();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function handleDelete(session: Session) {
    Alert.alert('Delete Session', `Remove all photos from ${session.client?.name ?? 'this client'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteSession(session.id); await fetchSessions(); },
      },
    ]);
  }

  async function handlePrint(session: Session, image: ImageEntry) {
    if (InstaxPrinter.getStatus() !== 'connected') {
      Alert.alert('Printer Not Connected', 'Connect your Instax printer in Settings.', [
        { text: 'Open Settings', onPress: () => router.push('/(app)/settings') },
        { text: 'Cancel' },
      ]);
      return;
    }
    setPrintingId(image.id);
    try {
      const url = image.processedUrl ?? image.downloadUrl;
      await InstaxPrinter.printImage(url);
      await logPrint(session.id, image.id);
      await fetchSessions();
    } catch (e: any) {
      Alert.alert('Print Failed', e.message);
    } finally {
      setPrintingId(null);
    }
  }

  if (sessions.length === 0 && !refreshing) {
    return (
      <View className="flex-1 bg-[#0A0A0A] items-center justify-center px-10 gap-4">
        <Text className="text-4xl">✅</Text>
        <Text className="text-white font-semibold text-lg">All clear</Text>
        <Text className="text-neutral-500 text-sm text-center">
          No sessions pending review. Generate a QR code to get started.
        </Text>
        <TouchableOpacity onPress={() => router.push('/(app)/qr')}
          className="px-6 py-3 bg-orange-500 rounded-xl mt-2">
          <Text className="text-white font-semibold text-sm">Generate QR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const groups = groupByDate(sessions);

  return (
    <>
      <ScrollView
        className="flex-1 bg-[#0A0A0A]"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        <View className="px-5 pt-14 pb-4">
          <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase">Admin</Text>
          <Text className="text-white text-2xl font-bold mt-0.5">Review</Text>
          <Text className="text-neutral-500 text-sm mt-1">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} pending
          </Text>
        </View>

        {groups.map(group => (
          <View key={group.label} className="mb-6">
            <View className="flex-row items-center px-5 mb-3 gap-2">
              <View className="px-2.5 py-0.5 rounded-full bg-neutral-800">
                <Text className="text-neutral-400 text-xs font-semibold">{group.label}</Text>
              </View>
              <View className="flex-1 h-px bg-border" />
            </View>

            {group.sessions.map(session => (
              <SessionWindow
                key={session.id}
                session={session}
                printingId={printingId}
                onImagePress={idx => openPreview(session, idx)}
                onEdit={img => router.push({ pathname: '/(app)/editor', params: { sessionId: session.id, imageId: img.id } })}
                onApproveAll={() => handleBatchApprove(session)}
                onDelete={() => handleDelete(session)}
                onPrint={img => handlePrint(session, img)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Fullscreen preview modal */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View className="flex-1 bg-black">
          <TouchableOpacity onPress={() => setPreviewVisible(false)}
            className="absolute top-14 right-5 z-10 w-9 h-9 rounded-full bg-white/20 items-center justify-center">
            <Text className="text-white text-base font-bold">✕</Text>
          </TouchableOpacity>
          <View className="absolute top-14 left-5 z-10">
            <Text className="text-white font-semibold">{previewSession?.client?.name}</Text>
            <Text className="text-neutral-400 text-xs">{previewIndex + 1} / {previewImages.length}</Text>
          </View>

          <FlatList
            data={previewImages}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={e => setPreviewIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W }} className="flex-1 items-center justify-center">
                <Image
                  source={{ uri: item.processedUrl ?? item.downloadUrl }}
                  style={{ width: SCREEN_W, height: SCREEN_W }}
                  resizeMode="contain"
                />
                <View className="flex-row gap-2 mt-4">
                  {item.approved && (
                    <View className="px-3 py-1 rounded-full bg-teal-500/20">
                      <Text className="text-teal-400 text-xs font-semibold">Approved</Text>
                    </View>
                  )}
                  {item.printed && (
                    <View className="px-3 py-1 rounded-full bg-teal-500/20">
                      <Text className="text-teal-400 text-xs font-semibold">Printed ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />

          {previewImages.length > 1 && (
            <View className="flex-row justify-center gap-1.5 pb-10">
              {previewImages.map((_, i) => (
                <View key={i}
                  className={`rounded-full ${i === previewIndex ? 'w-4 h-1.5 bg-orange-500' : 'w-1.5 h-1.5 bg-neutral-600'}`}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

interface WindowProps {
  session: Session; printingId: string | null;
  onImagePress: (index: number) => void; onEdit: (img: ImageEntry) => void;
  onApproveAll: () => void; onDelete: () => void; onPrint: (img: ImageEntry) => void;
}

function SessionWindow({ session, printingId, onImagePress, onEdit, onApproveAll, onDelete, onPrint }: WindowProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  return (
    <View className="mx-5 mb-4 bg-card rounded-3xl overflow-hidden border border-border">
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {session.client?.name ?? 'Unknown'}
          </Text>
          <Text className="text-neutral-500 text-xs mt-0.5">
            {session.images.length} photo{session.images.length !== 1 ? 's' : ''}
            {'  ·  '}{formatTTL(session.expiresAt)}
          </Text>
        </View>
        <StatusPill variant={session.status as any} />
      </View>

      <FlatList
        ref={listRef}
        data={session.images}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / CARD_W))}
        keyExtractor={i => i.id}
        renderItem={({ item, index }) => {
          const isPrinting = printingId === item.id;
          return (
            <Pressable onPress={() => onImagePress(index)} style={{ width: CARD_W }}>
              <View style={{ width: CARD_W, aspectRatio: 62 / 46, position: 'relative' }}>
                <Image
                  source={{ uri: item.processedUrl ?? item.downloadUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                {isPrinting && (
                  <View className="absolute inset-0 bg-black/70 items-center justify-center gap-2">
                    <ActivityIndicator color="#F97316" size="large" />
                    <Text className="text-orange-400 text-sm font-semibold">Printing…</Text>
                  </View>
                )}
                {item.printed && (
                  <View className="absolute inset-0 bg-black/50 items-center justify-center">
                    <View className="bg-teal-500/90 px-4 py-2 rounded-xl">
                      <Text className="text-white text-sm font-bold">Printed ✓</Text>
                    </View>
                  </View>
                )}
                {!item.printed && (
                  <View className="absolute top-2 left-2 right-2 flex-row justify-between">
                    <TouchableOpacity onPress={() => onEdit(item)}
                      className="px-2.5 py-1 rounded-lg bg-black/60 flex-row items-center gap-1">
                      <Text style={{ fontSize: 11 }}>✏️</Text>
                      <Text className="text-white text-xs font-semibold">Edit</Text>
                    </TouchableOpacity>
                    {item.approved && !isPrinting && (
                      <TouchableOpacity onPress={() => onPrint(item)}
                        className="px-2.5 py-1 rounded-lg bg-orange-500/90 flex-row items-center gap-1">
                        <Text style={{ fontSize: 11 }}>🖨️</Text>
                        <Text className="text-white text-xs font-semibold">Print</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/50 items-center justify-center">
                  <Text className="text-white text-xs">⛶</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {session.images.length > 1 && (
        <View className="flex-row justify-center gap-1.5 py-2">
          {session.images.map((_, i) => (
            <View key={i}
              className={`rounded-full ${i === activeIdx ? 'w-3 h-1.5 bg-orange-500' : 'w-1.5 h-1.5 bg-neutral-700'}`}
            />
          ))}
        </View>
      )}

      <View className="flex-row px-3 pb-3 pt-1 gap-2">
        {session.status === 'pending' && (
          <TouchableOpacity onPress={onApproveAll}
            className="flex-1 py-2.5 bg-teal-500 rounded-xl items-center">
            <Text className="text-white font-semibold text-sm">Approve All</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDelete}
          className="py-2.5 px-4 bg-neutral-800 rounded-xl items-center">
          <Text className="text-neutral-500 text-sm">Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
