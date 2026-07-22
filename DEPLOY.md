# Deploying (for real online multiplayer)

The whole app deploys as **one service**: the Node server serves the built
frontend, the REST API, and the WebSocket server on a single origin. Once it's
on a public host, you and anyone else can log in and play online from anywhere.

## Deploy to Render (free, supports WebSockets)

You'll do this part — it needs your own Render + GitHub accounts.

### Option A — Blueprint (one click, uses `render.yaml`)

1. Push this repo to GitHub (already done: `nicolantern/chess-game`).
2. Go to <https://render.com>, sign up (you can sign in with GitHub).
3. **New +** → **Blueprint** → connect the `chess-game` repo → **Apply**.
   Render reads `render.yaml`, builds, and starts the service.
4. When it's live, open the `https://<your-app>.onrender.com` URL. That's the
   whole game — log in and hit **Play Online**.

### Option B — Manual web service

**New +** → **Web Service** → pick the repo → set:

- **Runtime:** Node
- **Build command:** `npm install && npm run build && npm --prefix server install`
- **Start command:** `node server/index.js`
- **Environment variable:** `JWT_SECRET` = a long random string
- **Plan:** Free

Deploy, then open the service URL.

## Keeping it "always on" — for free

Render's free tier has two gaps for a 24/7 server. Both are covered for free by
the setup below; you don't have to pay for the $7 plan unless you want to skip
these two steps.

### 1. Stop it sleeping — free keep-alive ping

Free services sleep after ~15 min idle; the first request then takes ~30–50s to
wake. Keep it awake with a free external cron that pings the health endpoint:

1. Go to <https://cron-job.org> and sign up (free).
2. **Create cronjob** → URL `https://<your-app>.onrender.com/api/health`.
3. Schedule: **every 10 minutes**. Save.

That's it — the ping keeps the service warm, so players never hit a cold start.

### 2. Keep accounts from vanishing — free Neon database

By default accounts live in `server/data.json`, and the free tier's disk is
**ephemeral** — it resets on every restart or redeploy, wiping all logins. The
server now supports a **Postgres backend** (a free Neon database) that survives
restarts. Set it up once:

1. Go to <https://neon.tech> and sign up (free).
2. Create a project → copy its **connection string** (looks like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. In Render → your service → **Environment** → add:
   `DATABASE_URL` = the connection string you copied.
4. **Save** (Render redeploys). On boot you'll see
   `[store] using Postgres backend (durable accounts)` in the logs.

The server creates its own table on first boot — no SQL to run. If `DATABASE_URL`
is unset it falls back to the JSON file automatically, so local dev needs nothing.

## Good to know

- **WebSockets** work on Render's free tier — online play works out of the box,
  same origin, over `wss://` (HTTPS is automatic).
- **The $7 Render Starter plan** is optional: it never sleeps and includes a
  persistent disk, so it replaces *both* free steps above in one box. Take it
  only if you'd rather not wire up the cron + Neon yourself.
- **Alternative to Neon:** any Postgres works — Supabase also has a free tier.
  Or use a host with a **persistent volume** (Railway, Fly.io) and point
  `DATA_FILE` at the mounted path to keep the JSON file instead.

## Alternatives

- **Railway** (<https://railway.app>) — similar flow, and offers a **volume** so
  `server/data.json` can persist; set `DATA_FILE` to the volume path.
- **Fly.io** (<https://fly.io>) — supports volumes and WebSockets; needs the
  `fly` CLI.

## Split deployment (optional)

If you'd rather host the frontend statically (Netlify/Vercel/GitHub Pages) and
the server separately, build the frontend with the API origin baked in:

```bash
VITE_API_URL=https://your-server.onrender.com npm run build
```

and deploy `dist/`. The API server must then allow that origin via CORS.
