import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  subscribeSessions, getStats, type Session, type Stats,
} from '../../src/lib/api';
import { formatTTL } from '../../src/lib/cleanup';
import StatusPill from '../../src/components/StatusPill';
import { useAuth } from '../../src/state/AuthContext';

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats]       = useState<Stats>({ totalPrints: 0, todayPrints: 0, pendingSessions: 0, activeSessions: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive]         = useState(false);

  // Firestore real-time subscription (replaces Socket.io)
  useEffect(() => subscribeSessions(incoming => {
    setSessions(incoming);
    // Alert on newly pending sessions
    incoming.filter(s => s.status === 'pending').forEach(s => {
      Alert.alert(
        'New Upload',
        `${s.client?.name ?? 'Someone'} sent ${s.images.length} photo${s.images.length !== 1 ? 's' : ''}`,
        [
          { text: 'Review', onPress: () => router.push('/(app)/review') },
          { text: 'Later',  style: 'cancel' },
        ],
        { cancelable: true },
      );
    });
    setLive(true);
  }), []);

  const fetchStats = useCallback(async () => {
    try {
      const st = await getStats();
      setStats(st);
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const pending = sessions.filter(s => s.status === 'pending');

  return (
    <ScrollView
      className="flex-1 bg-[#0A0A0A]"
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
    >
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase">Admin</Text>
          <Text className="text-white text-2xl font-bold mt-0.5">Dashboard</Text>
          {user?.displayName ? (
            <Text className="text-neutral-600 text-xs mt-0.5">{user.displayName}</Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${live ? 'bg-teal-400' : 'bg-neutral-600'}`} />
          <Text className="text-neutral-500 text-xs">{live ? 'Live' : 'Connecting…'}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row px-5 gap-3 mb-6">
        <StatCard label="Today"   value={stats.todayPrints}     unit="prints"   accent />
        <StatCard label="Pending" value={stats.pendingSessions}  unit="sessions" />
        <StatCard label="Total"   value={stats.totalPrints}      unit="all time" />
      </View>

      {/* Quick actions */}
      <View className="px-5 mb-6">
        <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase mb-3">Quick Actions</Text>
        <View className="flex-row gap-3">
          <ActionButton emoji="⬛" label="New QR"  onPress={() => router.push('/(app)/qr')} accent />
          <ActionButton emoji="🖼️" label="Review" onPress={() => router.push('/(app)/review')} badge={pending.length} />
        </View>
      </View>

      {/* Pending sessions */}
      {pending.length > 0 && (
        <View className="px-5 mb-6">
          <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase mb-3">Needs Review</Text>
          <View className="gap-3">
            {pending.map(s => (
              <SessionCard key={s.id} session={s} onPress={() => router.push('/(app)/review')} />
            ))}
          </View>
        </View>
      )}

      {/* Recent sessions */}
      {sessions.filter(s => s.status !== 'pending').length > 0 && (
        <View className="px-5">
          <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase mb-3">Recent</Text>
          <View className="gap-2">
            {sessions.filter(s => s.status !== 'pending').slice(0, 5).map(s => (
              <SessionCard key={s.id} session={s} compact />
            ))}
          </View>
        </View>
      )}

      {sessions.length === 0 && !refreshing && (
        <View className="items-center justify-center px-10 py-20 gap-3">
          <Text className="text-4xl">📷</Text>
          <Text className="text-neutral-300 font-semibold text-center">No sessions yet</Text>
          <Text className="text-neutral-600 text-sm text-center">
            Generate a QR code and share it with your clients.
          </Text>
          <TouchableOpacity onPress={() => router.push('/(app)/qr')}
            className="mt-2 px-6 py-3 bg-orange-500 rounded-xl">
            <Text className="text-white font-semibold text-sm">Generate QR</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <View className="flex-1 bg-card rounded-2xl p-4">
      <Text className={`text-2xl font-bold ${accent ? 'text-orange-500' : 'text-white'}`}>{value}</Text>
      <Text className="text-neutral-400 text-xs mt-0.5">{label}</Text>
      <Text className="text-neutral-600 text-xs">{unit}</Text>
    </View>
  );
}

function ActionButton({ emoji, label, onPress, accent, badge }: {
  emoji: string; label: string; onPress: () => void; accent?: boolean; badge?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      className={`flex-1 py-4 rounded-2xl items-center gap-2 relative ${accent ? 'bg-orange-500' : 'bg-card'}`}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text className={`text-sm font-semibold ${accent ? 'text-white' : 'text-neutral-300'}`}>{label}</Text>
      {badge != null && badge > 0 && (
        <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function SessionCard({ session, onPress, compact }: { session: Session; onPress?: () => void; compact?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}
      className={`bg-card rounded-2xl px-4 ${compact ? 'py-3' : 'py-4'}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {session.client?.name ?? 'Waiting for client…'}
          </Text>
          <Text className="text-neutral-500 text-xs mt-0.5">
            {session.images.length} photo{session.images.length !== 1 ? 's' : ''}
            {session.client?.date ? `  ·  ${session.client.date}` : ''}
            {compact ? '' : `  ·  ${formatTTL(session.expiresAt)}`}
          </Text>
        </View>
        <StatusPill variant={session.status as any} />
      </View>
    </TouchableOpacity>
  );
}
