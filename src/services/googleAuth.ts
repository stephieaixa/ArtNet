import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<'success' | 'cancelled' | 'error'> {
  const redirectTo = makeRedirectUri({
    native: 'artnet://auth/callback',
  });

  console.log('[googleAuth] redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error('[googleAuth] Error al iniciar OAuth:', error?.message);
    return 'error';
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  console.log('[googleAuth] browser result type:', result.type);
  if ('url' in result) console.log('[googleAuth] result url:', result.url);

  if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled';
  if (result.type !== 'success') return 'error';

  const url = result.url;

  // Flujo PKCE: la URL tiene ?code=...
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[googleAuth] Error exchanging code:', exchangeError.message);
        return 'error';
      }
      return 'success';
    }
  } catch (e) { /* continúa con flujo implícito */ }

  // Flujo implícito: la URL tiene #access_token=...
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const params = new URLSearchParams(url.slice(hashIndex + 1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!sessionError) return 'success';
      console.error('[googleAuth] Error setting session:', sessionError.message);
    }
  }

  return 'error';
}
