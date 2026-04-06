import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
      <ActivityIndicator size="large" color={COLORS.white} />
    </View>
  );
}
