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

## Already provisioned

The D1 database and KV namespace exist and `wrangler.toml` already points
at them — this was done via the Cloudflare account tools rather than the
CLI, so there's no `wrangler d1 create` / `wrangler kv namespace create`
step left to run:

- D1 database `painter-ghosts` (`893f9e42-4304-4282-974e-679d0c2ab1b0`),
  in **Georgoskar@gmail.com's Account** — schema already applied, both
  `ghosts` and `presence` tables exist.
- KV namespace `painter-ghosts-RATE_LIMIT` (`c61b3690edc54fb4878c51b9e990c31f`),
  same account.

If you ever need to recreate either (wrong account, accidental deletion,
forking this repo into your own account), the original commands are:

```sh
cd worker
wrangler d1 create painter-ghosts        # → paste database_id into wrangler.toml
wrangler d1 execute painter-ghosts --remote --file=schema.sql
wrangler kv namespace create RATE_LIMIT  # → paste id into wrangler.toml
```

`schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running it
is always safe, including after a future schema change.

## Prerequisites to deploy

- Access to **Georgoskar@gmail.com's Account** on Cloudflare (the one the
  resources above live in) — free tier is enough.
- [`wrangler`](https://developers.cloudflare.com/workers/wrangler/), the
  Cloudflare CLI: `npm install -g wrangler`, or just use `npx wrangler …`
  for every command below.

## 1. Log in

```sh
wrangler login
```

Opens a browser tab to authorize the CLI. If your Cloudflare login has
access to more than one account, `wrangler` will ask you to pick one —
make sure it's **Georgoskar@gmail.com's Account**, since that's where the
D1 database and KV namespace above actually live. Deploying from the wrong
account produces a Worker with empty bindings that errors on every request.

## Allowed origins

`wrangler.toml` already lists the production domain:

```toml
[vars]
ALLOWED_ORIGINS = "https://painter-iota.vercel.app,http://localhost:4173"
```

Requests from any other origin get a CORS rejection, so if the game ever
moves to a different domain, add it here (comma-separated, no wildcards,
no trailing slash) — and keep `localhost` in the list at whatever port you
use for local dev (e.g. `npx serve .` or `http-server . -p 4173`) so local
testing still works.

## 2. Deploy

```sh
wrangler deploy
```

This prints your Worker's URL, something like:

```
https://painter-ghosts.<your-subdomain>.workers.dev
```

## 3. Point the game at it

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
