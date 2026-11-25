# Deploying

| Part | Where | Cost | URL / how players get it |
|---|---|---|---|
| Backend | Render free web service | **free**, no card | `https://codenames-pulp-api.onrender.com` |
| Web app | GitHub Pages | **free** | `https://derbaliadem.github.io/code-names-substitute/` (works in any phone or desktop browser) |
| Android app (testing) | EAS Build → `.apk` | **free** (Expo free plan, limited builds per month) | download link from expo.dev, install directly on Android |
| iOS app (testing) | Expo Go | **free** | scan the QR code from `npx expo start` with the Expo Go app |
| Google Play store | EAS Build + Submit | **$25 once** (Google developer account) | optional |
| Apple App Store / TestFlight | EAS Build + Submit | **$99 per year** (Apple Developer Program) | optional, the only way to install on iPhones without Expo Go |

So the game is **online and free** through the web app and the Android APK.
The app stores are optional extras that cost money.

---

## Backend: Render (backend agent + one-time owner step)

1. The backend agent commits `render.yaml` at the repo root:
   ```yaml
   services:
     - type: web
       name: codenames-pulp-api
       runtime: node
       plan: free
       rootDir: backend
       buildCommand: npm ci --include=dev && npm run build && npm prune --omit=dev
       startCommand: npm start
       healthCheckPath: /health
       autoDeploy: true
       envVars:
         - key: NODE_VERSION
           value: "22"
         - key: CORS_ORIGIN
           value: https://derbaliadem.github.io,https://codenames-pulp-api.onrender.com,http://localhost:8081,http://localhost:5173
         - key: CLIENT_IP_HEADER
           value: cf-connecting-ip
   ```
2. **One-time owner step:** sign in at <https://render.com> with GitHub, then **New → Blueprint** → this repo → **Apply**.
   Every later push to `main` redeploys automatically.
3. If Render gives a different URL, update `docs/PROTOCOL.md` §1, `frontend/src/config.ts`, `frontend/eas.json` and `CORS_ORIGIN` in `render.yaml`.

Free-tier limits: the service sleeps after 15 minutes idle (about 30–60 s to wake, and the app shows a banner while it does),
there are 750 instance-hours a month, and memory is wiped on restart. Keep **one** instance: rooms live in memory. To avoid cold starts for free, point
<https://uptimerobot.com> at `/health` every 10 minutes.

## Web app: GitHub Pages (frontend agent + one-time owner step)

1. `.github/workflows/pages.yml` runs on every push to `main` that touches `frontend/**`:
   `npm ci` → `EXPO_BASE_URL=/code-names-substitute npx expo export -p web` → publishes `frontend/dist`.
2. **One-time owner step:** GitHub → repo **Settings → Pages → Source: GitHub Actions**.

## Android: free APK from GitHub (no Expo account, about 15 min)

GitHub → **Actions → Android APK → Run workflow**. When it finishes, download `codenames-pulp-apk` from the run.
Pushing a tag such as `v1.0.0` also publishes the APK as a GitHub Release, with a link any phone can open.
Raise `version` and `android.versionCode` in `frontend/app.json` for every new APK, or phones won't update.

The APK is signed with the public Expo debug key: fine for friends, **not** for the Play Store, and Android will refuse to
update it with a build signed by another key (EAS, Play). Uninstall first when switching.

Building on Windows: use a short path outside OneDrive (like `C:\kb`), because of the 260-character limit, and run
`gradlew app:createBundleReleaseJsAndAssets --rerun` after changing `EXPO_PUBLIC_SERVER_URL`: Gradle doesn't notice the change
and would keep the old address in the APK.

## Android: free APK with EAS (owner runs this, about 15 min)

```bash
npm install -g eas-cli
cd frontend
eas login                      # free Expo account at expo.dev
eas init                       # links the project, writes the projectId into app.json → commit it
eas build -p android --profile preview
```
When the build finishes, expo.dev shows a download link and QR code for the `.apk`. Anyone can install it on Android
(they'll need to allow "install unknown apps").

## iOS

* **Free:** install **Expo Go** from the App Store, run `npx expo start` in `frontend/`, and scan the QR code. This is for testing and playing with friends on the same network or a tunnel (`npx expo start --tunnel`).
* **iPhone home-screen app, free:** open the GitHub Pages URL in Safari → Share → **Add to Home Screen**. It opens full screen with
  its own icon (`frontend/public/manifest.json`). Android Chrome offers **Install app** for the same page.
* **Real App Store / TestFlight app:** needs the $99/year Apple Developer Program, then
  `eas build -p ios --profile production` and `eas submit -p ios`. EAS builds in the cloud, so you don't need a Mac.

## Google Play (optional, $25 once)

`eas build -p android --profile production` (produces an `.aab`), then `eas submit -p android`.
