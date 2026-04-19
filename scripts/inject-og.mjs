/**
 * Inyecta Open Graph meta tags en dist/index.html después del build de Expo.
 * Necesario porque Expo Metro SPA mode ignora app/+html.tsx.
 */
import { readFileSync, writeFileSync } from 'fs';

const OG_TAGS = `
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

html = html.replace('</head>', `${OG_TAGS}\n</head>`);
writeFileSync(path, html);
console.log('✅ OG tags injected into dist/index.html');
