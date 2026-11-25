# Deploying for free

| Part | Host | Cost | URL |
|---|---|---|---|
| Frontend | GitHub Pages | free (public repo) | `https://derbaliadem.github.io/code-names-substitute/` |
| Backend | Render free web service | free, no card | `https://codenames-pulp-api.onrender.com` |

## Frontend – GitHub Pages (frontend agent)

1. `.github/workflows/pages.yml` uploads `frontend/` as the Pages artifact on every push to `main` that touches `frontend/**`.
2. **One-time manual step (repo owner):** GitHub → repo **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
3. After the next push, the site is live at the URL above.

## Backend – Render (backend agent + one-time owner step)

1. The backend agent commits `render.yaml` at the repo root:
   ```yaml
   services:
     - type: web
       name: codenames-pulp-api
       runtime: node
       plan: free
       rootDir: backend
       buildCommand: npm ci && npm run build
       startCommand: npm start
       healthCheckPath: /health
       autoDeploy: true
       envVars:
         - key: NODE_VERSION
           value: "20"
         - key: CORS_ORIGIN
           value: https://derbaliadem.github.io,http://localhost:5173
   ```
2. **One-time manual step (repo owner):** sign in at <https://render.com> with GitHub → **New → Blueprint** →
   pick this repository → **Apply**. Render reads `render.yaml` and deploys. Every later push to `main` redeploys automatically.
3. If Render gives a different URL, update `docs/PROTOCOL.md` §1 and `frontend/js/config.js`.

### Free-tier limits to know
* The service **sleeps after 15 minutes idle**, and the first request after that takes about 30–60 s. The frontend shows a "waking" banner.
* 750 free instance-hours per month, which is enough for one always-on service.
* Memory is wiped on every restart or deploy, so running games end. That's acceptable for this game.

### Optional: avoid cold starts (still free)
Create a free monitor on <https://uptimerobot.com> that pings `https://codenames-pulp-api.onrender.com/health` every 10 minutes.
