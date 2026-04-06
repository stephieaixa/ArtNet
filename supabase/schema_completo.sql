-- ============================================================
-- ArteLynk — Schema completo (correlo una sola vez)
-- Supabase → SQL Editor → pegá todo esto → Run
-- Es seguro correrlo aunque ya hayas corrido versiones anteriores
-- ============================================================

-- ─── FUNCIÓN updated_at (necesaria para los triggers) ────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;


-- ─── TRABAJOS SCRAPEADOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraped_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       TEXT UNIQUE NOT NULL,
  source_name     TEXT NOT NULL,
  source_url      TEXT,
  raw_text        TEXT,
  source_excerpt  TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  venue_name      TEXT,
  venue_type      TEXT,
  location_city   TEXT,
  location_country TEXT,
  region          TEXT,
  disciplines     TEXT[] DEFAULT '{}',
  start_date      TEXT,
  end_date        TEXT,
  deadline        TEXT,
  contact_email   TEXT,
  contact_url     TEXT,
  pay_info        TEXT,
  status          TEXT DEFAULT 'published',
  is_scraped      BOOLEAN DEFAULT TRUE,
  is_featured     BOOLEAN DEFAULT FALSE,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE scraped_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scraped_jobs_public_read" ON scraped_jobs;
CREATE POLICY "scraped_jobs_public_read" ON scraped_jobs FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "scraped_jobs_service_write" ON scraped_jobs;
CREATE POLICY "scraped_jobs_service_write" ON scraped_jobs FOR ALL USING (auth.role() = 'service_role');


-- ─── PORTFOLIO ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  type          TEXT NOT NULL DEFAULT 'photo',
  storage_path  TEXT NOT NULL,
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  title         TEXT,
  description   TEXT,
  duration_secs INTEGER,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio_public_read" ON portfolio_items;
CREATE POLICY "portfolio_public_read" ON portfolio_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "portfolio_owner_write" ON portfolio_items;
CREATE POLICY "portfolio_owner_write" ON portfolio_items FOR ALL USING (auth.uid() = user_id);


-- ─── FUENTES COMUNITARIAS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    UUID,
  type            TEXT NOT NULL,
  handle          TEXT,
  url             TEXT,
  name            TEXT,
  description     TEXT,
  language        TEXT DEFAULT 'es',
  region          TEXT,
  approx_members  INTEGER,
  status          TEXT DEFAULT 'pending',
  admin_notes     TEXT,
  reviewed_at     TIMESTAMPTZ,
  spam_score      FLOAT DEFAULT 0,
  upvotes         INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE community_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sources_public_read" ON community_sources;
CREATE POLICY "sources_public_read" ON community_sources FOR SELECT USING (status IN ('approved', 'monitoring'));
DROP POLICY IF EXISTS "sources_authenticated_insert" ON community_sources;
CREATE POLICY "sources_authenticated_insert" ON community_sources FOR INSERT WITH CHECK (true);


-- ─── PERFILES DE ARTISTAS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,
  display_name     TEXT,
  bio              TEXT,
  city             TEXT,
  country          TEXT,
  disciplines      TEXT[] DEFAULT '{}',
  available_from   TEXT,
  available_to     TEXT,
  instagram_handle TEXT,
  tiktok_handle    TEXT,
  youtube_url      TEXT,
  website_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "artist_profiles_read" ON artist_profiles;
CREATE POLICY "artist_profiles_read" ON artist_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "artist_profiles_write" ON artist_profiles;
CREATE POLICY "artist_profiles_write" ON artist_profiles FOR ALL USING (auth.uid() = user_id);
-- Agregar columnas si ya existía la tabla sin ellas
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS tiktok_handle    TEXT;
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS youtube_url      TEXT;
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS website_url      TEXT;


-- ─── PERFILES DE VENUES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL,
  venue_name    TEXT,
  venue_type    TEXT,
  description   TEXT,
  city          TEXT,
  country       TEXT,
  contact_name  TEXT,
  contact_title TEXT,
  website       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE venue_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venue_profiles_read" ON venue_profiles;
CREATE POLICY "venue_profiles_read" ON venue_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "venue_profiles_write" ON venue_profiles;
CREATE POLICY "venue_profiles_write" ON venue_profiles FOR ALL USING (auth.uid() = user_id);


-- ─── TRIGGERS updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS artist_profiles_updated_at ON artist_profiles;
CREATE TRIGGER artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS venue_profiles_updated_at ON venue_profiles;
CREATE TRIGGER venue_profiles_updated_at
  BEFORE UPDATE ON venue_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
