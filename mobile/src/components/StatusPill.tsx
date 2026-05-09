import React from 'react';
import { View, Text } from 'react-native';

type Variant = 'waiting' | 'pending' | 'approved' | 'completed' | 'connected' | 'disconnected' | 'printing' | 'error';

const config: Record<Variant, { label: string; dot: string; bg: string; text: string }> = {
  waiting:      { label: 'Waiting',      dot: 'bg-neutral-500', bg: 'bg-neutral-800', text: 'text-neutral-400' },
  pending:      { label: 'Pending',      dot: 'bg-orange-400',  bg: 'bg-orange-500/15', text: 'text-orange-400' },
  approved:     { label: 'Approved',     dot: 'bg-teal-400',    bg: 'bg-teal-500/15',  text: 'text-teal-400'   },
  completed:    { label: 'Completed',    dot: 'bg-teal-500',    bg: 'bg-teal-500/10',  text: 'text-teal-500'   },
  connected:    { label: 'Connected',    dot: 'bg-teal-400',    bg: 'bg-teal-500/15',  text: 'text-teal-400'   },
  disconnected: { label: 'Disconnected', dot: 'bg-neutral-500', bg: 'bg-neutral-800',  text: 'text-neutral-400' },
  printing:     { label: 'Printing…',    dot: 'bg-orange-400',  bg: 'bg-orange-500/15', text: 'text-orange-400' },
  error:        { label: 'Error',        dot: 'bg-red-400',     bg: 'bg-red-500/15',   text: 'text-red-400'    },
};

interface Props {
  variant: Variant;
  label?: string;
}

export default function StatusPill({ variant, label }: Props) {
  const c = config[variant] ?? config.disconnected;
  return (
    <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${c.bg}`}>
      <View className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <Text className={`text-xs font-medium ${c.text}`}>{label ?? c.label}</Text>
    </View>
  );
}
