-- Tokens de push notification por dispositivo
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT,  -- 'ios' | 'android'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(user_id);

-- Alertas de convocatorias por usuario
CREATE TABLE IF NOT EXISTS user_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}',
  -- filters = { venueTypes: [], genres: [], regions: [] }
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_alerts_user_idx ON user_alerts(user_id);

-- RLS
ALTER TABLE push_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_own" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_alerts_own" ON user_alerts
  FOR ALL USING (auth.uid() = user_id);
