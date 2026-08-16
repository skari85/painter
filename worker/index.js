/**
 * PAINTER: ASCENSION — ghost recordings worker.
 *
 * POST /ghosts             store a capped path + optional note for a zone
 * GET  /ghosts?zone=&limit= return the most recent recordings for a zone
 *
 * Bindings (see wrangler.toml): DB (D1), RATE_LIMIT (KV), ALLOWED_ORIGIN (var).
 */

const MAX_PATH_POINTS = 150;
const MAX_NOTE_LEN = 140;
const MAX_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
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

function sanitizeNote(note) {
  if (typeof note !== 'string') return null;
  const cleaned = note
    .replace(/<[^>]*>/g, '')
    .replace(CONTROL_CHARS, '')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_NOTE_LEN);
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
    'SELECT id, palette, path, note FROM ghosts WHERE zone_key = ? ORDER BY created_at DESC LIMIT ?'
  )
    .bind(zoneKey, limit)
    .all();

  const ghosts = results.map((row) => ({
    id: row.id,
    palette: JSON.parse(row.palette),
    path: JSON.parse(row.path),
    note: row.note ?? null,
  }));

  return json({ ghosts }, { status: 200 }, headers);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env.ALLOWED_ORIGIN);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname !== '/ghosts') {
      return json({ error: 'not found' }, { status: 404 }, headers);
    }

    if (request.method === 'POST') return handlePost(request, env, headers);
    if (request.method === 'GET') return handleGet(url, env, headers);

    return json({ error: 'method not allowed' }, { status: 405 }, headers);
  },
};
