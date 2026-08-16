/**
 * network.js — talks to the ghosts worker (see /worker in the repo root).
 *
 * Async, best-effort only: a failed fetch/upload is swallowed and the
 * game carries on with no ghosts for that zone. Nothing here is load-bearing
 * for the single-player game.
 */

const TIMEOUT_MS = 5000;

function ghostsEndpoint() {
  const runtimeValue = globalThis.PAINTER_CONFIG?.ghostsEndpoint;
  const metaValue = document
    .querySelector('meta[name="painter-ghosts-endpoint"]')
    ?.getAttribute('content');
  const value = String(runtimeValue || metaValue || '').trim();

  // The multiplayer layer is optional. An unset or template URL must never
  // produce network noise or interfere with the single-player experience.
  if (!value || /YOUR-SUBDOMAIN/i.test(value)) return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Fetch up to `limit` recent ghost recordings for a zone. Never throws. */
export async function fetchGhosts(zoneKey, limit = 8) {
  const endpoint = ghostsEndpoint();
  if (!endpoint) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${endpoint}?zone=${encodeURIComponent(zoneKey)}&limit=${limit}`;
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.ghosts) ? data.ghosts : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Upload a recorded path (+ optional note) for a zone. Fire-and-forget. */
export async function uploadGhost({ zoneKey, palette, path, note }) {
  const endpoint = ghostsEndpoint();
  if (!endpoint) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneKey, palette, path, note: note || null }),
    });
  } catch {
    /* best-effort — a dropped upload just means one less ghost later */
  } finally {
    clearTimeout(timer);
  }
}
