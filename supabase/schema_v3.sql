-- ============================================================
-- ArteLynk — Schema v3: Perfiles de artistas y venues
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS artist_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL,
  display_name  TEXT,
  bio           TEXT,
  city          TEXT,
  country       TEXT,
  disciplines   TEXT[] DEFAULT '{}',
  available_from TEXT,
  available_to  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artist_profiles_read"  ON artist_profiles FOR SELECT USING (true);
CREATE POLICY "artist_profiles_write" ON artist_profiles FOR ALL   USING (auth.uid() = user_id);

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
CREATE POLICY "venue_profiles_read"  ON venue_profiles FOR SELECT USING (true);
CREATE POLICY "venue_profiles_write" ON venue_profiles FOR ALL   USING (auth.uid() = user_id);

-- Trigger updated_at automático
CREATE TRIGGER artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER venue_profiles_updated_at
  BEFORE UPDATE ON venue_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
