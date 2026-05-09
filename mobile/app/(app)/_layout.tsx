import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View className={`items-center justify-center w-10 h-10 rounded-xl ${focused ? 'bg-orange-500/20' : ''}`}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: 'QR Code',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⬛" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🖼️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
      {/* editor is not a tab — accessed from review */}
      <Tabs.Screen name="editor" options={{ href: null }} />
    </Tabs>
  );
}
