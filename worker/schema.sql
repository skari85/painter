-- Ghost recordings: short path snippets + optional notes left by past sessions.
-- No accounts, no PII — just a pseudonymous trace of where a player walked.

CREATE TABLE IF NOT EXISTS ghosts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  zone_key TEXT NOT NULL,
  palette TEXT NOT NULL,   -- JSON: {skin, top, bottom, hair, hat?}
  path TEXT NOT NULL,      -- JSON: [{t,x,y,z,yaw}, ...], capped length
  note TEXT                -- nullable, length-capped, sanitized
);

CREATE INDEX IF NOT EXISTS idx_ghosts_zone ON ghosts (zone_key, created_at DESC);
