-- Agregar redes sociales a artist_profiles
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle    TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url      TEXT,
  ADD COLUMN IF NOT EXISTS website_url      TEXT;
