import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getHistory, getStats, type HistoryEntry, type Stats } from '../../src/lib/api';

export default function HistoryScreen() {
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [stats, setStats]       = useState<Stats>({ totalPrints: 0, todayPrints: 0, pendingSessions: 0, activeSessions: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState<'all' | 'today'>('today');

  const fetchData = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([getHistory(), getStats()]);
      setHistory(h);
      setStats(s);
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const filtered = filter === 'today'
    ? history.filter(h => h.printedAt >= todayStart.getTime())
    : history;

  const groups: Record<string, HistoryEntry[]> = {};
  filtered.forEach(entry => {
    const d = new Date(entry.printedAt);
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  });

  return (
    <ScrollView
      className="flex-1 bg-[#0A0A0A]"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
    >
      <View className="px-5 pt-14 pb-4">
        <Text className="text-neutral-500 text-xs font-semibold tracking-widest uppercase">Admin</Text>
        <Text className="text-white text-2xl font-bold mt-0.5">Print History</Text>
      </View>

      {/* Stats */}
      <View className="flex-row px-5 gap-3 mb-5">
        <View className="flex-1 bg-card rounded-2xl p-4">
          <Text className="text-orange-500 text-2xl font-bold">{stats.todayPrints}</Text>
          <Text className="text-neutral-400 text-xs">Today</Text>
        </View>
        <View className="flex-1 bg-card rounded-2xl p-4">
          <Text className="text-white text-2xl font-bold">{stats.totalPrints}</Text>
          <Text className="text-neutral-400 text-xs">All Time</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View className="flex-row px-5 gap-2 mb-5">
        {(['today', 'all'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl ${filter === f ? 'bg-orange-500' : 'bg-card'}`}>
            <Text className={`text-sm font-semibold ${filter === f ? 'text-white' : 'text-neutral-400'}`}>
              {f === 'today' ? 'Today' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* History list */}
      {Object.keys(groups).length === 0 ? (
        <View className="items-center justify-center px-10 py-16 gap-3">
          <Text className="text-3xl">📋</Text>
          <Text className="text-neutral-400 font-semibold text-center">No prints yet</Text>
          <Text className="text-neutral-600 text-sm text-center">
            {filter === 'today' ? 'Nothing printed today.' : 'Print history will appear here.'}
          </Text>
        </View>
      ) : (
        <View className="px-5 gap-6">
          {Object.entries(groups).map(([date, entries]) => (
            <View key={date}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">{date}</Text>
                <Text className="text-neutral-600 text-xs">{entries.length} print{entries.length !== 1 ? 's' : ''}</Text>
              </View>
              <View className="gap-2">
                {entries.map(entry => <HistoryRow key={entry.id} entry={entry} />)}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const time = new Date(entry.printedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <View className="bg-card rounded-2xl flex-row items-center px-3 py-3 gap-3">
      {entry.thumbnail ? (
        <Image source={{ uri: entry.thumbnail }} className="w-14 h-14 rounded-xl" resizeMode="cover" />
      ) : (
        <View className="w-14 h-14 rounded-xl bg-neutral-800 items-center justify-center">
          <Text style={{ fontSize: 22 }}>🖼️</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>{entry.clientName}</Text>
        {entry.clientDate ? <Text className="text-neutral-500 text-xs mt-0.5">{entry.clientDate}</Text> : null}
        <Text className="text-neutral-600 text-xs mt-0.5">{time}</Text>
      </View>
      <View className="w-5 h-5 rounded-full bg-teal-500/20 items-center justify-center">
        <Text className="text-teal-400 text-xs">✓</Text>
      </View>
    </View>
  );
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function isYesterday(d: Date): boolean {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
}
