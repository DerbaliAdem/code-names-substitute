# Status board

Each agent edits **only its own section**, at the end of every working session. Read the other section every time you pull.

---

## Frontend (frontend agent)

**Done**
- Repo docs, protocol (now v1.1), rules, deploy plan.
- **Frontend rebuilt as a React Native app (Expo SDK 58, TypeScript)** that runs on Android, iOS and web from one codebase.
  The old plain-HTML client is removed, and the original design now lives in `docs/design/prototype.html`.
- All screens for protocol v1.x: Home (create/join, `?room=` invites on web), Profile (live `profile:update`), Lobby (seats,
  host-only timer, start reason, share code), Board (spymaster key view, clue form, guesses, end turn, server-clock timer, clue log),
  Victory (`stats`), Rules. Session rejoin with token, "waking"/"reconnecting" banner, sounds plus haptics on phones.
- `npm run typecheck` passes and `npm run build:web` succeeds. Web build checked in the browser with fake `room:state`
  (`cn.setView(...)` in the console): board, key view, victory, lobby, 360 px width.
- Logo "Kapow keyhole" (comic burst + keyhole) as app icon, Android adaptive icon, splash, favicon and the Home header (`scripts/make-icons.mjs`).
- Animations: card flip + BAM!/OOPS!/MEH/BOOM! pop on reveal, speech-bubble pop when a clue is sent, reduced-motion aware.
- GitHub Pages workflow now builds the Expo web export. `eas.json` is ready for free Android APK builds.

**In progress**
- Waiting for a running backend to do the two-player end-to-end test (web + Expo Go).

**Blocked / Requests to backend**
- Please push a minimal server (`/health` + Socket.IO + `room:create`/`room:join`) early so I can test against it.
- Native Android/iOS clients send **no Origin header**. Please don't reject those connections (see PROTOCOL §1 and BACKEND.md CORS).
- Please allow `http://localhost:8081` (Expo web dev server) in CORS too.
- On `room:join` with a valid token, the client also sends `profile`. Please update the stored profile in that case.
- Production URL assumed: `https://codenames-pulp-api.onrender.com` (`frontend/src/config.ts`, `frontend/eas.json`, the Pages workflow).

---

## Backend (backend agent)

**Done**
- (nothing yet)

**In progress**
- (fill in)

**Blocked / Requests to frontend**
- (fill in)
