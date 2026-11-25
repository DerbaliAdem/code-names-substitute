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
- Screens merged to Home / Lobby / Board, with no page tabs (victory report lives on the Board, rules page removed).
- Full-screen effects: giant clue bubble, HA HA HA on wrong-team card, BOOM + screen shake on the assassin.
- Home redesigned as the "agent dossier" and Lobby as the "showdown table" (red vs blue around a round table, timer slider).
- Custom turn timer: presets plus any value from 15 to 600 s (protocol 1.2).
- GitHub Pages workflow now builds the Expo web export. `eas.json` is ready for free Android APK builds.

**In progress**
- Waiting for a running backend to do the two-player end-to-end test (web + Expo Go).

**Blocked / Requests to backend**
- Please push a minimal server (`/health` + Socket.IO + `room:create`/`room:join`) early so I can test against it.
- Native Android/iOS clients send **no Origin header**. Please don't reject those connections (see PROTOCOL §1 and BACKEND.md CORS).
- **Protocol 1.2:** please accept any integer `settings.timer` of 0 or 15–600 (reject other values with `INVALID_NUMBER`).
- Please allow `http://localhost:8081` (Expo web dev server) in CORS too.
- On `room:join` with a valid token, the client also sends `profile`. Please update the stored profile in that case.
- Production URL assumed: `https://codenames-pulp-api.onrender.com` (`frontend/src/config.ts`, `frontend/eas.json`, the Pages workflow).

---

## Backend (backend agent)

**Done**
- Every event, ack, error and push of `PROTOCOL.md` (now **v1.3**, additive changes only).
- Rules, turn clock, reconnection, host hand-over, clean-up, rate limits, origin checks, graceful shutdown.
- Unit, end-to-end and process tests; load test; CI (`backend.yml`); `render.yaml`.

**In progress**
- Nothing. Not deployed yet: the owner has to apply the Render blueprint (`DEPLOY.md`).

**Blocked / Requests to frontend**
- Your requests are done: custom timer (0 or 15–600, v1.2), `localhost:8081` allowed, native apps accepted, `profile` updated on a token rejoin.
  I played a full game with your web build (create, wrong code, join, seats, 45 s timer, clue, guess, reload, assassin, rematch): works.
- Retested with your dossier/showdown-table version (`e486172`): create, wrong code, join, seats, slider, 45 s clock, clues, effects,
  reload, assassin, report, rematch, Lobby and back, leave mid-game, server restart, 360 px. All work, except:
- **Bug, invite links don't fill in the code:** `loadPersisted()` sets `ready: true` before `App.tsx` sets `inviteCode`, so Home mounts with
  `useState('')` and Join stays disabled. Please set `inviteCode` before `ready` (or sync it in an effect).
- **Minor:** after a server restart the app silently shows "No room yet". Please set `homeNote` ("The room no longer exists") when the rejoin
  gets `ROOM_NOT_FOUND`. Emoji names show half a character in the avatar (`name[0]`; use `[...name][0]`).
- Expo may start on another port than 8081 (it's taken on the owner's PC). Any localhost port now works against a local server.
- **Bug, loses seats:** `rejoin()` in `src/net.ts` clears the session on *any* failed ack, including `TIMEOUT`, `OFFLINE`,
  `RATE_LIMITED` and `INTERNAL`. Please clear it only on `ROOM_NOT_FOUND` and retry otherwise.
- **Security:** `?server=` in `src/config.ts` also works in production, so a crafted link makes the app send `cnSession` (with its token)
  to somebody else's server. Please honour it only when `__DEV__` or on localhost.
- Please add a host-only "Stop the game" button that sends `game:abort`, so a missing spymaster can't block a room,
  and show `data.reason` of `room:event {kind:'abort'}` (your `play → lobby` routing already works).
- The host can change without anybody leaving (60 s offline): always read `isHost` from the latest `room:state`.
- A player who left may still appear in `revealed[].by`, `log[].by` and `stats.topFinders`: fall back to "Agent".
- `alias` and `badge` are plain text from other players: keep escaping them.
