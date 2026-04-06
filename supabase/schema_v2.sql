-- ============================================================
-- ArteLynk — Schema v2
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── STORAGE BUCKETS ─────────────────────────────────────────
-- Crear en: Supabase Dashboard → Storage → New bucket

-- bucket: "avatars"     → público, máx 5MB, solo imágenes
-- bucket: "portfolio"   → público, máx 100MB, imágenes + videos

-- ─── TABLA: PORTFOLIO ITEMS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolio_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,                    -- auth.uid()
  type          TEXT NOT NULL DEFAULT 'photo',    -- 'photo' | 'video'
  storage_path  TEXT NOT NULL,                    -- path en Supabase Storage
  url           TEXT NOT NULL,                    -- URL pública
  thumbnail_url TEXT,                             -- para videos
  title         TEXT,
  description   TEXT,
  duration_secs INTEGER,                          -- duración si es video
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver portfolio ajeno (para el directorio de artistas)
CREATE POLICY "portfolio_public_read" ON portfolio_items
  FOR SELECT USING (true);

-- Solo el dueño puede insertar/actualizar/borrar
CREATE POLICY "portfolio_owner_write" ON portfolio_items
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_items(user_id, sort_order);


-- ─── TABLA: COMMUNITY SOURCES ─────────────────────────────────
-- Usuarios sugieren grupos, canales, páginas para que el scraper las monitoree

CREATE TABLE IF NOT EXISTS community_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by  UUID,                             -- auth.uid() (puede ser anónimo)
  type          TEXT NOT NULL,                    -- 'telegram' | 'facebook_group' | 'instagram' | 'whatsapp' | 'website' | 'other'
  handle        TEXT,                             -- @canal o nombre del grupo
  url           TEXT,                             -- URL directa si la tienen
  name          TEXT,                             -- nombre descriptivo
  description   TEXT,                             -- qué tipo de contenido tiene
  language      TEXT DEFAULT 'es',                -- idioma principal
  region        TEXT,                             -- región geográfica que cubre
  approx_members INTEGER,                         -- miembros aproximados si saben

  -- Moderación
  status        TEXT DEFAULT 'pending',           -- 'pending' | 'approved' | 'rejected' | 'monitoring'
  admin_notes   TEXT,
  reviewed_at   TIMESTAMPTZ,

  -- Calidad / spam detection
  spam_score    FLOAT DEFAULT 0,                  -- 0 = limpio, 1 = spam
  upvotes       INTEGER DEFAULT 0,                -- otros usuarios que validaron esta fuente

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_sources ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver fuentes aprobadas
CREATE POLICY "sources_public_read" ON community_sources
  FOR SELECT USING (status IN ('approved', 'monitoring'));

-- Usuarios autenticados pueden sugerir
CREATE POLICY "sources_authenticated_insert" ON community_sources
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Solo service role puede moderar
CREATE POLICY "sources_service_moderate" ON community_sources
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_sources_status ON community_sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_type   ON community_sources(type);


-- ─── TABLA: SPAM REPORTS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS spam_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID,                               -- scraped_jobs.id
  source_id   UUID,                               -- community_sources.id
  reported_by UUID,
  reason      TEXT,                               -- 'spam' | 'fake' | 'expired' | 'inappropriate' | 'other'
  details     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE spam_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spam_reports_insert" ON spam_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ─── STORAGE POLICIES ─────────────────────────────────────────
-- Ejecutar DESPUÉS de crear los buckets en el dashboard

-- Para bucket "avatars":
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Para bucket "portfolio":
-- INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true);

-- Policies para avatars:
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies para portfolio:
CREATE POLICY "portfolio_public_read_storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'portfolio');

CREATE POLICY "portfolio_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "portfolio_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'portfolio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
