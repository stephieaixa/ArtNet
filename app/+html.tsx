import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML shell for the Expo web build.
 *
 * The `font-size: max(16px, 1em)` rule on inputs prevents iOS Safari from
 * auto-zooming when the user taps any text field (Safari zooms if font-size < 16px).
 * This does NOT disable pinch-to-zoom — it only stops the involuntary zoom on focus.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1.0, user-scalable=no"
        />
        <title>ArtNet — La red de artistas escénicos</title>

        {/* Open Graph / WhatsApp / Telegram */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://artnet-circus.vercel.app" />
        <meta property="og:site_name" content="ArtNet" />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:title" content="ArtNet — La red que conecta artistas escénicos con el mundo" />
        <meta property="og:description" content="La red unificada para artistas de circo, acrobacia y varieté. Conectamos talentos con hoteles, cruceros, festivales y productoras de todo el mundo. Descubrí oportunidades reales." />
        <meta property="og:image" content="https://artnet-circus.vercel.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ArtNet — La red que conecta artistas escénicos con el mundo" />
        <meta name="twitter:description" content="La red unificada para artistas de circo, acrobacia y varieté. Conectamos talentos con oportunidades reales en todo el mundo." />
        <meta name="twitter:image" content="https://artnet-circus.vercel.app/og-image.png" />

        <style dangerouslySetInnerHTML={{
          __html: `
            input, textarea, select {
              font-size: max(16px, 1em) !important;
            }
            html, body { overflow-x: hidden; max-width: 100%; }
            * { touch-action: pan-x pan-y; }
          `,
        }} />
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('touchmove', function(e) {
              if (e.touches.length > 1) e.preventDefault();
            }, { passive: false });
            document.addEventListener('gesturestart', function(e) {
              e.preventDefault();
            }, { passive: false });
          `,
        }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
