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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            input, textarea, select {
              font-size: max(16px, 1em) !important;
            }
          `,
        }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
