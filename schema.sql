CREATE TABLE IF NOT EXISTS scores (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 25000),
  scope TEXT NOT NULL CHECK (scope IN ('usa', 'world', 'any')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scores_scope_created_score
  ON scores (scope, created_at DESC, score DESC);
