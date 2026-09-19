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

-- Live presence: one row per open browser tab, upserted on every heartbeat.
-- Ephemeral by construction — rows with no recent heartbeat are pruned on
-- write, so this table only ever holds "who's here right now".
CREATE TABLE IF NOT EXISTS presence (
  session_id TEXT PRIMARY KEY,
  zone_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  yaw REAL NOT NULL,
  persona_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  palette TEXT NOT NULL,    -- JSON: {skin, hair, top, bottom}
  line TEXT,                -- nullable, length-capped, sanitized chat line
  line_at INTEGER           -- when `line` was set; lets peers show it once
);

CREATE INDEX IF NOT EXISTS idx_presence_zone ON presence (zone_key, updated_at DESC);
