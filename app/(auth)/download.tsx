import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function DownloadScreen() {
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}
