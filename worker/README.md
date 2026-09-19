# painter-ghosts — deploying the Worker

This is the only piece of PAINTER: ASCENSION that isn't a static file. It's
a small Cloudflare Worker backing two optional systems — the game runs
fine without it, single-player, and just quietly never shows anyone else:

- **`/ghosts`** — asynchronous replays of past sessions' recorded routes,
  with an optional note that burns after 24 hours.
- **`/presence`** — the live social layer: every open tab heartbeats its
  position (+ chat line) roughly every 1.3s and gets back everyone else
  currently live in the same zone.

Both share one D1 database and one KV namespace. There's nothing to run
continuously — Workers are request-scoped, and the whole thing sits on
Cloudflare's free tier at this game's scale (a handful of concurrent
players, not a viral product).

## Prerequisites

- A Cloudflare account (free tier is enough).
- [`wrangler`](https://developers.cloudflare.com/workers/wrangler/), the
  Cloudflare CLI: `npm install -g wrangler`, or just use `npx wrangler …`
  for every command below.

## 1. Log in

```sh
wrangler login
```

Opens a browser tab to authorize the CLI against your Cloudflare account.

## 2. Create the D1 database

```sh
cd worker
wrangler d1 create painter-ghosts
```

This prints a `database_id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "painter-ghosts"
database_id = "<paste it here>"
```

## 3. Apply the schema

```sh
wrangler d1 execute painter-ghosts --remote --file=schema.sql
```

`schema.sql` creates both tables — `ghosts` (recorded routes) and
`presence` (live players) — plus their indexes. It's idempotent
(`CREATE TABLE IF NOT EXISTS`), so re-running it after a future schema
change is safe.

## 4. Create the KV namespace

```sh
wrangler kv namespace create RATE_LIMIT
```

Copy the printed `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<paste it here>"
```

This is used for per-IP rate limiting on both routes — a one-shot lock on
`/ghosts` uploads, a 60-second fixed-window counter on `/presence`
heartbeats (see the comments in `index.js` if you're curious why those two
are different).

## 5. Set your allowed origins

Edit the `ALLOWED_ORIGINS` var in `wrangler.toml` — a comma-separated list
of the exact origins the Worker should accept requests from (no wildcards,
no trailing slash):

```toml
[vars]
ALLOWED_ORIGINS = "https://your-deployed-game.example.com,http://localhost:4173"
```

Requests from any other origin get a CORS rejection. Keep `localhost` (at
whatever port you use for local dev, e.g. `npx serve .` or
`http-server . -p 4173`) in the list so local testing still works.

## 6. Deploy

```sh
wrangler deploy
```

This prints your Worker's URL, something like:

```
https://painter-ghosts.<your-subdomain>.workers.dev
```

## 7. Point the game at it

The game only needs the `/ghosts` URL — `/presence` is derived
automatically from it on the client (see `js/core/network.js`). Open
`index.html` and set:

```html
<meta name="painter-ghosts-endpoint" content="https://painter-ghosts.<your-subdomain>.workers.dev/ghosts" />
```

Redeploy the static site (Vercel, or wherever it's hosted) with that
change. From this point on, ghosts and live players both come alive —
nothing else needs touching.

## Verifying it worked

- Open the game in two browser tabs (or two devices), start a run in each,
  and pick different personas at character select. Walk into the same
  room in both — you should see the other one as a solid figure. Press
  `T` in one and you should see the line appear over their head, and as a
  subtitle, in the other within a couple of seconds.
- Leave a ghost note (walk up to a pale figure, `E`, type something) and
  reload — it should replay with your note attached.
- If nobody ever shows up: check the browser console for CORS errors
  (origin not in `ALLOWED_ORIGINS`), confirm the meta tag has no typo and
  ends in `/ghosts`, and confirm `wrangler d1 execute … --remote` actually
  ran against the remote database (omitting `--remote` applies the schema
  to a local shadow DB instead, which is easy to do by accident).

## Updating the Worker later

Any time `worker/index.js` or `worker/schema.sql` changes:

```sh
wrangler d1 execute painter-ghosts --remote --file=schema.sql   # if schema.sql changed
wrangler deploy                                                  # always, if index.js changed
```

## Cost

At this game's realistic scale, all of this stays inside Cloudflare's free
tier: Workers (100k requests/day), D1 (5GB storage, generous read/write
limits), and KV (100k reads/day, 1k writes/day — the rate-limit counters
are the only KV writes, one per request that isn't itself rate-limited).
