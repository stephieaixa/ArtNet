/**
 * Post-build: inyecta OG tags, fix iOS 100dvh y scripts de recarga en dist/index.html.
 * También copia assets públicos a dist/.
 * Expo Metro genera su propio dist/index.html sin nada de esto, así que lo hacemos aquí.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';

const path = 'dist/index.html';
let html = readFileSync(path, 'utf8');

// ── 1. OG tags + PWA meta (solo si no están ya) ──────────────────────────────
if (!html.includes('og:title')) {
  const ogTags = `
  <!-- Favicon & PWA -->
  <link rel="icon" type="image/png" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="ArtNet" />
  <!-- Open Graph / WhatsApp / Telegram -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://artnet-circus.vercel.app" />
  <meta property="og:site_name" content="ArtNet" />
  <meta property="og:locale" content="es_AR" />
  <meta property="og:title" content="ArtNet — Plataforma de búsqueda inteligente para artistas escénicos" />
  <meta property="og:description" content="Tu red unificada. Postulá y buscá oportunidades reales. Conectamos talentos con hoteles, cruceros, festivales y productoras de todo el mundo." />
  <meta property="og:image" content="https://artnet-circus.vercel.app/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="ArtNet — Plataforma de búsqueda inteligente para artistas escénicos" />
  <meta name="twitter:description" content="Tu red unificada. Postulá y buscá oportunidades reales. Conectamos talentos con hoteles, cruceros, festivales y productoras de todo el mundo." />
  <meta name="twitter:image" content="https://artnet-circus.vercel.app/og-image.png" />`;
  html = html.replace('</head>', `${ogTags}\n</head>`);
  console.log('✅ OG tags injected');
}

// ── 2. iOS Safari: 100dvh fix (siempre, después del expo-reset) ──────────────
// Expo reset pone #root { height: 100% } → en iOS Safari usa 100vh que incluye
// la barra del browser y la tab bar queda fuera del viewport visible.
// Sobreescribimos con 100dvh (dynamic viewport height) usando !important.
if (!html.includes('100dvh')) {
  const dvhFix = `
  <style>
    /* iOS Safari: usar dvh para que la tab bar no quede detrás de la barra del browser */
    #root { height: 100dvh !important; overflow: hidden; }
  </style>`;
  html = html.replace('</head>', `${dvhFix}\n</head>`);
  console.log('✅ iOS 100dvh fix injected');
}

// ── 3. Service Worker + iOS reload fixes (siempre) ───────────────────────────
if (!html.includes('serviceWorker')) {
  const swScript = `
  <script>
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }
    // iOS bfcache: recarga al restaurar desde historial
    window.addEventListener('pageshow', function(e) { if (e.persisted) { window.location.reload(); } });
    // iOS: recarga si vuelve de otra app después de >2s (evita pantalla en blanco)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('_ht', Date.now());
      } else if (document.visibilityState === 'visible') {
        var t = sessionStorage.getItem('_ht');
        if (t && Date.now() - parseInt(t) > 2000) { window.location.reload(); }
      }
    });
  </script>`;
  html = html.replace('</head>', `${swScript}\n</head>`);
  console.log('✅ SW + iOS reload scripts injected');
}

writeFileSync(path, html);

// ── 4. Copiar assets públicos ─────────────────────────────────────────────────
if (existsSync('public/sw.js')) {
  copyFileSync('public/sw.js', 'dist/sw.js');
  console.log('✅ Service worker copied to dist/sw.js');
}
if (existsSync('public/apple-touch-icon.png')) {
  copyFileSync('public/apple-touch-icon.png', 'dist/apple-touch-icon.png');
  console.log('✅ apple-touch-icon copied to dist/');
}
