import { Slot } from 'expo-router';
import { View, Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <View style={[{ flex: 1 }, Platform.OS === 'web' && ({ height: '100dvh' } as any)]}>
      <Slot />
    </View>
  );
}
