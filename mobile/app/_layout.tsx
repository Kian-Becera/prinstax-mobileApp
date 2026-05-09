import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/state/AuthContext';
import { registerCleanupTask } from '../src/lib/cleanup';

function RouteGate({ children }: { children: React.ReactNode }) {
  const { authed, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!authed && !inAuthGroup) router.replace('/(auth)/login');
    if (authed && inAuthGroup) router.replace('/(app)/dashboard');
  }, [authed, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => { registerCleanupTask().catch(() => {}); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0b0b10' }}>
      <AuthProvider>
        <RouteGate>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0b0b10' },
              headerTintColor: '#fff',
              contentStyle: { backgroundColor: '#0b0b10' },
            }}
          />
        </RouteGate>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
