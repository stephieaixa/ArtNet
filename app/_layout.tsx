import '../src/i18n';
import { useEffect } from 'react';
import { Slot, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          role: (session.user.user_metadata?.role ?? 'artist') as 'artist' | 'venue',
          avatar_url: session.user.user_metadata?.avatar_url,
          created_at: session.user.created_at,
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User opened the recovery link from email → go to reset password screen
        router.replace('/(auth)/reset-password');
        return;
      }
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          role: (session.user.user_metadata?.role ?? 'artist') as 'artist' | 'venue',
          avatar_url: session.user.user_metadata?.avatar_url,
          created_at: session.user.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Slot />
    </QueryClientProvider>
  );
}
