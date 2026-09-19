/**
 * PAINTER: ASCENSION — ghosts & live presence worker.
 *
 * POST /ghosts               store a capped path + optional note for a zone
 * GET  /ghosts?zone=&limit=  return the most recent recordings for a zone
 * POST /presence             heartbeat: upsert this tab's spot + optional
 *                             chat line, and get back everyone else currently
 *                             live in the same zone. The real-time social
 *                             layer — polled every ~1.3s, no WebSocket needed.
 *
 * Bindings (see wrangler.toml): DB (D1), RATE_LIMIT (KV), ALLOWED_ORIGIN (var).
 */

const MAX_PATH_POINTS = 150;
const MAX_NOTE_LEN = 140;
const MAX_SHORT_TEXT_LEN = 40;
const MAX_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const NOTE_TTL_MS = 24 * 60 * 60 * 1000;
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Presence tuning: a row counts as "live" for LIVE_WINDOW_MS after its last
// heartbeat (must comfortably exceed the client's ~1.3s beat), is hard-deleted
// after STALE_MS of silence, and a chat line rides along for LINE_DISPLAY_MS
// so a peer who just arrived doesn't see someone's message replayed stale.
const LIVE_WINDOW_MS = 10_000;
const LINE_DISPLAY_MS = 8_000;
const STALE_MS = 30_000;
const MAX_PEERS = 24;
const PRESENCE_MAX_PER_WINDOW = 90; // ≈1.5 req/s sustained per IP, 60s fixed window
const MAX_COORD = 2000;

function corsHeaders(request, configuredOrigins = '') {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : null;

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data, init, headers) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers, ...(init?.headers ?? {}) },
  });
}

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/<[^>]*>/g, '')
    .replace(CONTROL_CHARS, '')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

function sanitizeNote(note) {
  return sanitizeText(note, MAX_NOTE_LEN);
}

function sanitizeSessionId(value) {
  return typeof value === 'string' && SESSION_ID_RE.test(value) ? value : null;
}

function sanitizeCoord(n, limit = MAX_COORD) {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

function sanitizePosition(x, y, z, yaw) {
  const sx = sanitizeCoord(x), sy = sanitizeCoord(y), sz = sanitizeCoord(z), syaw = sanitizeCoord(yaw, 1000);
  if (sx === null || sy === null || sz === null || syaw === null) return null;
  return { x: sx, y: sy, z: sz, yaw: syaw };
}

function sanitizePath(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const clean = [];
  for (const p of path.slice(0, MAX_PATH_POINTS)) {
    if (!p || typeof p !== 'object') continue;
    const { t, x, y, z, yaw } = p;
    if (![t, x, y, z, yaw].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    clean.push({ t, x, y, z, yaw });
  }
  return clean.length ? clean : null;
}

function sanitizePalette(palette) {
  if (!palette || typeof palette !== 'object') return null;
  const out = {};
  for (const key of ['skin', 'hair', 'top', 'bottom', 'hat']) {
    const v = palette[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff) out[key] = v;
  }
  if (!out.skin || !out.hair || !out.top || !out.bottom) return null;
  return out;
}

async function checkRateLimit(env, ip) {
  const key = `rl:${ip}`;
  const existing = await env.RATE_LIMIT.get(key);
  if (existing) return false;
  await env.RATE_LIMIT.put(key, '1', { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return true;
}

/**
 * Presence heartbeats arrive far more often than ghost uploads, so this is a
 * real fixed-window counter (not the one-shot lock above): up to
 * PRESENCE_MAX_PER_WINDOW requests per IP per 60s, tracked by wall-clock
 * window start rather than key expiry (KV's expirationTtl only ever
 * *extends* a key, so refreshing it on every write would never let the
 * window reset while a client keeps beating).
 */
async function checkPresenceRateLimit(env, ip) {
  const key = `rlp:${ip}`;
  const now = Date.now();
  let windowStart = now;
  let count = 0;
  try {
    const raw = await env.RATE_LIMIT.get(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.windowStart === 'number' && now - parsed.windowStart < 60_000) {
        windowStart = parsed.windowStart;
        count = parsed.count || 0;
      }
    }
  } catch { /* corrupt/missing value — treat as a fresh window */ }

  if (count >= PRESENCE_MAX_PER_WINDOW) return false;
  await env.RATE_LIMIT.put(key, JSON.stringify({ windowStart, count: count + 1 }), { expirationTtl: 90 });
  return true;
}

async function handlePost(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 }, headers);
  }

  const zoneKey = typeof body.zoneKey === 'string' ? body.zoneKey.slice(0, 64) : null;
  const palette = sanitizePalette(body.palette);
  const path = sanitizePath(body.path);
  const note = sanitizeNote(body.note);

  if (!zoneKey || !palette || !path) {
    return json({ error: 'missing or invalid zoneKey/palette/path' }, { status: 400 }, headers);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const allowed = await checkRateLimit(env, ip);
  if (!allowed) {
    return json({ error: 'rate limited' }, { status: 429 }, headers);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO ghosts (id, created_at, zone_key, palette, path, note) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, Date.now(), zoneKey, JSON.stringify(palette), JSON.stringify(path), note)
    .run();

  return json({ id }, { status: 201 }, headers);
}

async function handleGet(url, env, headers) {
  const zoneKey = url.searchParams.get('zone');
  if (!zoneKey) return json({ error: 'missing zone' }, { status: 400 }, headers);

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 8));

  const { results } = await env.DB.prepare(
    'SELECT id, created_at, palette, path, note FROM ghosts WHERE zone_key = ? ORDER BY created_at DESC LIMIT ?'
  )
    .bind(zoneKey, limit)
    .all();

  const now = Date.now();
  const ghosts = results.map((row) => {
    const noteExpiresAt = row.note ? Number(row.created_at) + NOTE_TTL_MS : null;
    const noteIsAlive = noteExpiresAt && noteExpiresAt > now;
    return {
      id: row.id,
      palette: JSON.parse(row.palette),
      path: JSON.parse(row.path),
      // The recording can remain, but its message only belongs to the next day.
      note: noteIsAlive ? row.note : null,
      noteExpiresAt: noteIsAlive ? noteExpiresAt : null,
    };
  });

  return json({ ghosts }, { status: 200 }, headers);
}

async function handlePresence(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 }, headers);
  }

  const sessionId = sanitizeSessionId(body.sessionId);
  const zoneKey = typeof body.zoneKey === 'string' ? body.zoneKey.slice(0, 64) : null;
  const personaId = sanitizeText(body.personaId, MAX_SHORT_TEXT_LEN);
  const displayName = sanitizeText(body.displayName, MAX_SHORT_TEXT_LEN);
  const palette = sanitizePalette(body.palette);
  const pos = sanitizePosition(body.x, body.y, body.z, body.yaw);
  const line = sanitizeNote(body.line);

  if (!sessionId || !zoneKey || !personaId || !displayName || !palette || !pos) {
    return json({ error: 'missing or invalid presence fields' }, { status: 400 }, headers);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const allowed = await checkPresenceRateLimit(env, ip);
  if (!allowed) {
    return json({ error: 'rate limited' }, { status: 429 }, headers);
  }

  const now = Date.now();
  const lineAt = line ? now : null;

  // A heartbeat with no fresh line keeps whatever the player last said
  // (COALESCE) so it survives the next poll or two; handleGet-style reads
  // below only surface it while it's within LINE_DISPLAY_MS.
  await env.DB.prepare(
    `INSERT INTO presence (session_id, zone_key, updated_at, x, y, z, yaw, persona_id, display_name, palette, line, line_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       zone_key = excluded.zone_key,
       updated_at = excluded.updated_at,
       x = excluded.x, y = excluded.y, z = excluded.z, yaw = excluded.yaw,
       persona_id = excluded.persona_id,
       display_name = excluded.display_name,
       palette = excluded.palette,
       line = COALESCE(excluded.line, presence.line),
       line_at = COALESCE(excluded.line_at, presence.line_at)`
  )
    .bind(sessionId, zoneKey, now, pos.x, pos.y, pos.z, pos.yaw, personaId, displayName, JSON.stringify(palette), line, lineAt)
    .run();

  // Cheap, unconditional GC: presence is small and this keeps the table
  // from ever accumulating rows nobody will read again.
  await env.DB.prepare('DELETE FROM presence WHERE updated_at < ?').bind(now - STALE_MS).run();

  const { results } = await env.DB.prepare(
    `SELECT session_id, x, y, z, yaw, persona_id, display_name, palette, line, line_at
     FROM presence WHERE zone_key = ? AND session_id != ? AND updated_at >= ?
     ORDER BY updated_at DESC LIMIT ?`
  )
    .bind(zoneKey, sessionId, now - LIVE_WINDOW_MS, MAX_PEERS)
    .all();

  const players = results.map((row) => {
    const lineIsFresh = row.line && row.line_at && now - Number(row.line_at) <= LINE_DISPLAY_MS;
    return {
      sessionId: row.session_id,
      x: row.x, y: row.y, z: row.z, yaw: row.yaw,
      personaId: row.persona_id,
      name: row.display_name,
      palette: JSON.parse(row.palette),
      line: lineIsFresh ? row.line : null,
      lineAt: lineIsFresh ? Number(row.line_at) : null,
    };
  });

  return json({ players }, { status: 200 }, headers);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!headers['Access-Control-Allow-Origin']) {
        return json({ error: 'origin not allowed' }, { status: 403 }, headers);
      }
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/presence') {
      if (request.method === 'POST') return handlePresence(request, env, headers);
      return json({ error: 'method not allowed' }, { status: 405 }, headers);
    }

    if (url.pathname !== '/ghosts') {
      return json({ error: 'not found' }, { status: 404 }, headers);
    }

    if (request.method === 'POST') return handlePost(request, env, headers);
    if (request.method === 'GET') return handleGet(url, env, headers);

    return json({ error: 'method not allowed' }, { status: 405 }, headers);
  },
};
