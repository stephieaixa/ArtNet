import { useEffect } from 'react';
import { Slot, router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS } from '../../src/constants/theme';

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading]);

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.white} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}
