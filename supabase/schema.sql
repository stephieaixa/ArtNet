-- ============================================================
-- ArteLynk — Schema de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================


-- ─── TABLA PRINCIPAL DE TRABAJOS SCRAPEADOS ────────────────────────────────

CREATE TABLE IF NOT EXISTS scraped_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fuente
  source_id       TEXT UNIQUE NOT NULL,  -- hash para deduplicación
  source_name     TEXT NOT NULL,         -- 'CircusTalk', 'Telegram @castingcirco', etc.
  source_url      TEXT,                  -- URL del post original
  raw_text        TEXT,                  -- fragmento del texto original
  source_excerpt  TEXT,                  -- extracto más relevante (generado por IA)

  -- Trabajo
  title           TEXT NOT NULL,
  description     TEXT,
  venue_name      TEXT,
  venue_type      TEXT,                  -- cruise_ship | hotel | festival | circus | ...
  location_city   TEXT,
  location_country TEXT,
  region          TEXT,                  -- europa | america_latina | america_norte | ...
  disciplines     TEXT[] DEFAULT '{}',   -- ['aerial_silk', 'juggling', ...]
  start_date      TEXT,
  end_date        TEXT,
  deadline        TEXT,                  -- fecha límite de postulación
  contact_email   TEXT,
  contact_url     TEXT,
  pay_info        TEXT,

  -- Estado
  status          TEXT DEFAULT 'published',  -- published | pending_review | rejected
  is_scraped      BOOLEAN DEFAULT TRUE,
  is_featured     BOOLEAN DEFAULT FALSE,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_status     ON scraped_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_region     ON scraped_jobs(region);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_venue_type ON scraped_jobs(venue_type);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_scraped_at ON scraped_jobs(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_disciplines ON scraped_jobs USING GIN(disciplines);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scraped_jobs_updated_at
  BEFORE UPDATE ON scraped_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE scraped_jobs ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver trabajos publicados
CREATE POLICY "scraped_jobs_public_read" ON scraped_jobs
  FOR SELECT USING (status = 'published');

-- Solo el service role puede insertar/actualizar (el scraper usa service key)
CREATE POLICY "scraped_jobs_service_write" ON scraped_jobs
  FOR ALL USING (auth.role() = 'service_role');


-- ─── VISTA UNIFICADA (trabajos scrapeados + posteados manualmente) ─────────
-- Opcional: una vista que combina ambas tablas para mostrar en el feed

-- (Descomentá cuando también crees la tabla de jobs manuales)
-- CREATE OR REPLACE VIEW all_jobs AS
--   SELECT id, title, description, venue_name, venue_type, location_city,
--          location_country, region, disciplines, start_date, end_date,
--          contact_email, contact_url, pay_info, status, created_at,
--          source_name, source_url, is_scraped
--   FROM scraped_jobs WHERE status = 'published'
-- UNION ALL
--   SELECT id, title, description, venue_name, venue_type, location_city,
--          location_country, region, disciplines, start_date, end_date,
--          contact_email, contact_url, pay_info, status, created_at,
--          'Manual' AS source_name, NULL AS source_url, FALSE AS is_scraped
--   FROM job_posts WHERE status = 'published';


-- ─── STATS VIEW (para el dashboard) ──────────────────────────────────────

CREATE OR REPLACE VIEW scraper_stats AS
  SELECT
    source_name,
    COUNT(*) AS total,
    MAX(scraped_at) AS last_scraped,
    COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '24 hours') AS last_24h,
    COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '7 days')  AS last_7d
  FROM scraped_jobs
  GROUP BY source_name
  ORDER BY total DESC;
