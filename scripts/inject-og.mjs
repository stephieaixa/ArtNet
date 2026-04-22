/**
 * Inyecta Open Graph meta tags en dist/index.html después del build de Expo.
 * Necesario porque Expo Metro SPA mode ignora app/+html.tsx.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';

const OG_TAGS = `
  <!-- Favicon & PWA icons -->
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

const path = 'dist/index.html';
let html = readFileSync(path, 'utf8');

if (html.includes('og:title')) {
  console.log('OG tags already present, skipping.');
  process.exit(0);
}

// Fix iOS Safari 100vh bug: use dvh so the tab bar is never hidden behind the browser toolbar
const viewportFix = `\n  <style>
    html,body{height:100%;margin:0;padding:0;}
    body>div{height:100dvh;overflow:hidden;}
  </style>`;
html = html.replace('</head>', `${OG_TAGS}${viewportFix}\n</head>`);
// Inject service worker registration + iOS reload fixes
const swReg = `\n  <script>
    if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js');}
    // iOS Safari bfcache restore → reload
    window.addEventListener('pageshow',function(e){if(e.persisted){window.location.reload();}});
    // iOS: reload when returning from another app after >2s to avoid blank page
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden'){
        sessionStorage.setItem('_ht',Date.now());
      } else if(document.visibilityState==='visible'){
        var t=sessionStorage.getItem('_ht');
        if(t && Date.now()-parseInt(t)>2000){window.location.reload();}
      }
    });
  </script>`;
html = html.replace('</head>', `${swReg}\n</head>`);

writeFileSync(path, html);
console.log('✅ OG tags injected into dist/index.html');

// Copy service worker to dist/
const swSrc = 'public/sw.js';
if (existsSync(swSrc)) {
  copyFileSync(swSrc, 'dist/sw.js');
  console.log('✅ Service worker copied to dist/sw.js');
}

// Copy apple-touch-icon to dist/
const touchIconSrc = 'public/apple-touch-icon.png';
if (existsSync(touchIconSrc)) {
  copyFileSync(touchIconSrc, 'dist/apple-touch-icon.png');
  console.log('✅ apple-touch-icon copied to dist/');
}
