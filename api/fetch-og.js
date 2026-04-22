/**
 * GET /api/fetch-og?url=https://...
 * Fetches Open Graph metadata (image, title, description) from a URL server-side.
 * This bypasses browser CORS restrictions so the app can preview any public link.
 */
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Invalid protocol' });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArtNetBot/1.0; +https://artnet-circus.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(200).json({ error: 'fetch_failed', status: response.status });
    }

    const html = await response.text();

    // Extract OG / meta tags
    function getMeta(property) {
      const match =
        html.match(new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+name=["']twitter:${property}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${property}["']`, 'i'));
      return match?.[1]?.trim() ?? null;
    }

    function getTitle() {
      const og = getMeta('title');
      if (og) return og;
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match?.[1]?.trim() ?? null;
    }

    const image = getMeta('image');
    const title = getTitle();
    const description = getMeta('description');

    // Detect login walls (private Facebook/Instagram groups)
    const isLoginWall =
      html.includes('log in') || html.includes('Log In') ||
      html.includes('inicia sesión') || html.includes('Inicia sesión') ||
      html.includes('create an account') || html.includes('crea una cuenta') ||
      html.includes('must be logged in') || html.includes('sign in to continue');

    res.status(200).json({
      image: image || null,
      title: title || null,
      description: description || null,
      is_login_wall: isLoginWall,
    });
  } catch (err) {
    res.status(200).json({ error: 'timeout_or_blocked', message: err.message });
  }
}
