/**
 * ai.js — the ghostwriter.
 *
 * A tiny Groq client that writes ambient party chatter in character.
 * The key lives in js/local.env. (gitignored — never committed).
 * If anything is missing, offline, or rate-limited, the ghost simply
 * doesn't show up and the game keeps its authored voice. No exceptions
 * escape this file; the party must go on.
 */

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';   // fast enough for party gossip
const TIMEOUT_MS = 7000;

export class Ghostwriter {
  #key = null;
  #failures = 0;

  get enabled() { return !!this.#key && this.#failures < 3; }

  /** Fetch + parse the gitignored env file. Never throws. */
  async init() {
    try {
      const res = await fetch('js/local.env.', { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      const m = text.match(/GROQ_API_KEY\s*=\s*["']?([\w.-]+)["']?/);
      if (m) this.#key = m[1];
    } catch { /* no key, no ghost — the authored lines carry the night */ }
  }

  /**
   * One chat completion → trimmed string, or null on any failure.
   * Failures are counted; three strikes and the ghost clocks out
   * for the session rather than haunting the console.
   */
  async write(system, user, { maxTokens = 140, temperature = 1.0 } = {}) {
    if (!this.enabled) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.#key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`groq ${res.status}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      this.#failures = 0;
      return text || null;
    } catch {
      this.#failures++;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
