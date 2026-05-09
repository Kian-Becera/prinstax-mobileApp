import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/state/AuthContext';

export default function Index() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0A0A0A]">
        <ActivityIndicator color="#F97316" size="large" />
      </View>
    );
  }

  return <Redirect href={authenticated ? '/(app)/dashboard' : '/(auth)/login'} />;
}
