import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0b0b10' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Prinstax' }} />
      <Stack.Screen name="qr" options={{ title: 'New session' }} />
      <Stack.Screen name="review" options={{ title: 'Review session' }} />
      <Stack.Screen name="editor" options={{ title: 'Edit image' }} />
      <Stack.Screen name="history" options={{ title: 'Print history' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
