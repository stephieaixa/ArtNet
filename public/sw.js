/**
 * ArtNet Service Worker
 * Handles Web Share Target Level 2 (file sharing from iOS/Android share sheet).
 * When a user shares an image to ArtNet, this SW intercepts the POST,
 * stores the image in Cache API, and redirects to /post/share?has_image=1
 */

const SHARE_CACHE = 'artnet-share-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Intercept POST to /post/share (Web Share Target with files)
  if (req.method === 'POST' && url.pathname === '/post/share') {
    event.respondWith(handleShareTarget(req));
    return;
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();

    const image = formData.get('image');
    const title = (formData.get('title') || '').toString();
    const text = (formData.get('text') || '').toString();
    const sharedUrl = (formData.get('url') || '').toString();

    // Store image in cache so the page can read it
    if (image && typeof image === 'object' && image.size > 0) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        '/shared-image',
        new Response(image, { headers: { 'Content-Type': image.type || 'image/jpeg' } })
      );
    }

    // Build redirect URL with text params
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (text) params.set('text', text);
    if (sharedUrl) params.set('url', sharedUrl);
    if (image && typeof image === 'object' && image.size > 0) params.set('has_image', '1');

    const qs = params.toString();
    return Response.redirect(`/post/share${qs ? '?' + qs : ''}`, 303);
  } catch {
    return Response.redirect('/post/share', 303);
  }
}
