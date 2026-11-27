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
- Removed the victory jingle (`win.wav`); short effect sounds (tap, boom, tick, clue, laugh) and haptics stay.
- **Fixed "install" replacing the app instead of updating it (v1.2.1):** release APKs weren't all signed with
  the same key (CI used the React Native template's default debug keystore; the phone's copy may have come from
  an earlier EAS build with a different key), so Android saw each release as a different, conflicting app.
  Added a persistent release keystore (`ANDROID_KEYSTORE_BASE64`/`_PASSWORD`, `ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD`
  repo secrets, not in git) and `frontend/plugins/withReleaseSigning.js`, an Expo config plugin that points
  `android/app/build.gradle`'s release build type at it (falls back to the debug keystore if the file/secret is
  ever missing, so local `gradlew assembleRelease` still works). `android.yml` decodes the secret before building.
  v1.2.0 and earlier used a different/inconsistent key, so anyone with one of those installed needs to uninstall
  it once; from v1.2.1 on, every release should update in place. Verified the generated Gradle file picks the
  right signing config and the CI build succeeds; couldn't verify the APK's embedded certificate byte-for-byte
  (no Android SDK/`apksigner` in this environment) — the real test is that v1.2.1 and the next release install
  over each other cleanly.
- **Lobby rebuilt as "poster cards"**: yellow room ticket (offset red shadow) with INVITE/SHARE + LEAVE, two stacked
  RED/BLUE team cards with a round yellow VS badge overlapping between them (spymaster seat + 3 agent seats each),
  a cream "MISSION BRIEFING" checklist with a done/4 badge, ENGLISH/العربية toggle, a −/+ turn-timer stepper, and a
  START GAME bar that shows the not-ready reason. Same seat/ready/timer/lang wiring as before, just restyled.
  Checked in the web build: taking seats, the checklist and begin label update live.
- Keyboard-covers-input fix: `app.json` sets Android `softwareKeyboardLayoutMode: "resize"`, and `App.tsx` wraps the
  screen in a `KeyboardAvoidingView` (`padding` on iOS). Covers the room-code boxes, code name and clue fields.
  Not re-tested on a physical device/emulator this session — only typechecked and run in the web build (no on-screen
  keyboard there to reproduce the original bug), so please flag it if it still happens on Android/iOS.

**In progress**
- Waiting for a running backend to do the two-player end-to-end test (web + Expo Go).

**Blocked / Requests to backend**
- Please add a lot more words to both `WORDS` and `WORDS_AR` — the user hit repeats/wants more variety. Keep them as
  everyday single nouns, no proper names, same style as the current groups.
- **Protocol 1.4 (additive, frontend side done, not yet tested against a server):**
  1. `settings.lang`: accept `'en' | 'ar'` in `settings:update` (lobby, host only), include it in `room:state`, and deal the board
     from an **Arabic word list** when it is `'ar'` (please add one, ~400 common nouns, single words, no diacritics). Changing it
     in the lobby should deal a new board. Keep Arabic words as they are (no upper-casing); clue checks should normalise Arabic too.
  2. `game:rematch { swap: true }`: move every seated player to the other team, same role. The frontend now always sends it.
- Please push a minimal server (`/health` + Socket.IO + `room:create`/`room:join`) early so I can test against it.
- Native Android/iOS clients send **no Origin header**. Please don't reject those connections (see PROTOCOL §1 and BACKEND.md CORS).
- **Protocol 1.2:** please accept any integer `settings.timer` of 0 or 15–600 (reject other values with `INVALID_NUMBER`).
- Please allow `http://localhost:8081` (Expo web dev server) in CORS too.
- On `room:join` with a valid token, the client also sends `profile`. Please update the stored profile in that case.
- Production URL assumed: `https://codenames-pulp-api.onrender.com` (`frontend/src/config.ts`, `frontend/eas.json`, the Pages workflow).

---

## Backend (backend agent)

**Done**
- Every event, ack, error and push of `PROTOCOL.md` **v1.4**: Arabic boards (`settings.lang`, 545 words, clue checks ignore
  diacritics, tatweel, alef forms and ta marbuta; `room:state` always has `settings.lang`) and `game:rematch { swap }`.
- Rules, turn clock, reconnection, host hand-over, clean-up, rate limits, origin checks, graceful shutdown.
- Unit, end-to-end and process tests; load test; CI (`backend.yml`); `render.yaml`.

**In progress**
- Nothing. Not deployed yet: the owner has to apply the Render blueprint (`DEPLOY.md`).

**Blocked / Requests to frontend**
- Your requests are done: custom timer (0 or 15–600, v1.2), `localhost:8081` allowed, native apps accepted, `profile` updated on a token rejoin.
  I played a full game with your web build (create, wrong code, join, seats, 45 s timer, clue, guess, reload, assassin, rematch): works.
- Retested with your dossier/showdown-table version (`e486172`): create, wrong code, join, seats, slider, 45 s clock, clues, effects,
  reload, assassin, report, rematch, Lobby and back, leave mid-game, server restart, 360 px (Home and Lobby). All work.
- Expo may start on another port than 8081 (it's taken on the owner's PC). Any localhost port now works against a local server.
- **Fixed in `frontend/` by the backend agent at the owner's request (please pull before editing these files):**
  - `src/net.ts`: `rejoin()` keeps the session on temporary failures and retries with a growing delay (the banner shows "Reconnecting");
    it only gives up on a final answer, and then goes Home with a message.
  - `src/config.ts`: `?server=` works in development only, so a crafted link can't send a player's token elsewhere.
  - `src/screens/Home.tsx`: invite links fill in the room code again.
  - `src/components/Text.tsx` (new): on Android the comic font lost its last letter ("7" read as "1", "BLUE WINS!" showed "BLUE").
    **Import `Text` from there**, not from `react-native`.
  - `app.json`: no microphone, overlay or storage permissions; no backup of session tokens; `versionCode`.
  - `expo-asset` and `expo-system-ui` added (missing peer dependency; Android dark mode); `public/` makes the web app installable.
  - v1.1.0: APK down from 57 MB to 12 MB (one APK per processor type, compressed native code, only the 3 fonts in use:
    import fonts from `@expo-google-fonts/<family>/<weight>`, never the package index). New-version screen (`UpdatePrompt`).
  - `.github/workflows/android.yml` (new) builds the APK. A native release build was played on an Android 15 emulator.
  - `src/components/ui.tsx`: `initial(name)` shows emoji initials whole.
- Please add a host-only "Stop the game" button that sends `game:abort`, so a missing spymaster can't block a room,
  and show `data.reason` of `room:event {kind:'abort'}` (your `play → lobby` routing already works).
- The host can change without anybody leaving (60 s offline): always read `isHost` from the latest `room:state`.
- A player who left may still appear in `revealed[].by`, `log[].by` and `stats.topFinders`: fall back to "Agent".
- `alias` and `badge` are plain text from other players: keep escaping them.
