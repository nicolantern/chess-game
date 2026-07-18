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

## Good to know

- **WebSockets** work on Render's free tier — online play works out of the box,
  same origin, over `wss://` (HTTPS is automatic).
- **Cold starts:** free services sleep after ~15 min idle; the first request
  then takes ~30–50s to wake. Fine for casual play.
- **Storage is ephemeral on the free tier.** Accounts live in `server/data.json`,
  which resets whenever the service restarts or redeploys. So logins are *not*
  durable on free Render. To make accounts persist you can either:
  - use a host with a **persistent volume** (Railway, Fly.io), pointing
    `DATA_FILE` at the mounted path, or
  - swap the JSON store (`server/store.js`) for a real database (Postgres via
    Neon/Supabase, or Redis via Upstash — all have free tiers).
  Ask and I can wire one of these in.

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
