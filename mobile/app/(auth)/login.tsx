import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { signInWithGitHubCode } from '../../src/lib/auth';

// Required for Expo's auth proxy to complete the session on iOS
WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '';

// In Expo Go: routes through auth.expo.io proxy (HTTPS, accepted by GitHub)
// In dev build: uses the prinstax:// scheme registered in app.json
const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ['read:user', 'user:email'],
      redirectUri,
    },
    discovery,
  );

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      handleCode(code);
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'GitHub sign-in was cancelled.');
      setLoading(false);
    }
  }, [response]);

  async function handleCode(code: string) {
    setLoading(true);
    setError('');
    try {
      await signInWithGitHubCode(code, redirectUri);
      router.replace('/(app)/dashboard');
    } catch (e: any) {
      setError(e.message ?? 'Sign-in failed. Check your Firebase and GitHub OAuth configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    setError('');
    setLoading(true);
    await promptAsync();
    // setLoading(false) is handled in useEffect after response arrives
  }

  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center px-8 gap-10">

      {/* Logo */}
      <View className="items-center gap-3">
        <View className="w-20 h-20 rounded-3xl bg-orange-500 items-center justify-center">
          <Text className="text-white text-4xl font-black">P</Text>
        </View>
        <Text className="text-2xl font-bold text-white tracking-tight">PrintStax</Text>
        <Text className="text-neutral-500 text-sm text-center max-w-xs">
          Admin console for Instax photo printing
        </Text>
      </View>

      {/* Sign-in button */}
      <View className="w-full gap-4">
        <TouchableOpacity
          onPress={handleSignIn}
          disabled={!request || loading}
          className="w-full flex-row items-center justify-center gap-3 py-4 bg-[#24292e] rounded-2xl disabled:opacity-50"
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Text className="text-white text-lg font-bold">⌥</Text>
                <Text className="text-white font-semibold text-base">Continue with GitHub</Text>
              </>
          }
        </TouchableOpacity>

        {error ? (
          <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}
      </View>

      <Text className="text-neutral-700 text-xs text-center max-w-xs leading-relaxed">
        Sign in with the GitHub account you configured in Firebase Auth.
      </Text>

    </View>
  );
}
