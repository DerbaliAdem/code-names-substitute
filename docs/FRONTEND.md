# Frontend guide (for the frontend agent)

You own `frontend/` and `.github/workflows/pages.yml`. Read `AGENTS.md`, `docs/PROTOCOL.md` and `docs/RULES.md` first.

## Stack (fixed)

| Concern | Choice |
|---|---|
| Language | **Plain JavaScript (ES modules)**, HTML, CSS. **No build step, no framework.** |
| Realtime | Socket.IO client 4.7.5 from CDN: `https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js` |
| Fonts | Google Fonts: Bangers + Barlow Condensed (as in the prototype) |
| Sound | WebAudio synth (copied from the prototype) |
| Hosting | **GitHub Pages**, deployed by `.github/workflows/pages.yml` from the `frontend/` folder |
| Local dev | `npx serve -l 5173 frontend` |

## Visual reference

`frontend/prototype.html` is the approved design: pulp comic style with inked panels, hard shadows, a halftone background,
the Bangers display font, red ▲ stripes and blue ● dots for colour-blind safety, and light/dark/auto themes.
**Keep this look.** Reuse its CSS and markup, and replace its storage logic (`window.claude` db) with the Socket.IO protocol.
Don't ship `prototype.html` as the app; it stays only as a reference.

## Folder layout to create

```
frontend/
├── index.html          markup for all screens (from prototype)
├── css/style.css       styles from prototype, split out
├── js/
│   ├── config.js       SERVER_URL: localhost → http://localhost:3000, else the Render URL from PROTOCOL.md §1
│   ├── net.js          socket wrapper: connect, emit-with-ack → Promise, reconnect + rejoin with cnSession
│   ├── state.js        current RoomView + subscribers; clock-skew offset from serverNow
│   ├── ui/
│   │   ├── home.js     create / join by code, "waking server" banner
│   │   ├── profile.js  name, alias, colour, badge (localStorage cnProfile)
│   │   ├── lobby.js    teams, seats, settings (host only), start button with reason
│   │   ├── board.js    grid, clue form, turn banner, timer bar, clue log
│   │   ├── win.js      victory report from RoomView.stats
│   │   └── rules.js
│   ├── sound.js        sfx, driven by room:event (fallback: diff consecutive room:state)
│   ├── theme.js        auto / light / dark (localStorage cnTheme)
│   └── main.js         hash router (#home #profile #lobby #board #win #rules), wiring
├── mock/mock-server.js optional: fake room:state for working before the backend exists
└── 404.html            copy of index.html so deep links work on Pages
```

## Behaviour

* **Rendering:** all UI comes from the latest `RoomView`. Never compute the key client-side.
  Show coloured cards for spymasters when `view.key` isn't null.
* **Routing on phase change:** `lobby → play` goes to `#board`, `play → over` goes to `#win`, `over → lobby` (rematch) goes to `#lobby`.
* **Permissions in the UI** (the server re-checks every one):
  * Clue form is visible if `me.role==='spymaster' && me.team===turn && !clue && phase==='play'`.
  * Cards are clickable if `me.role==='agent' && me.team===turn && clue`.
  * End-turn button is visible if the player is an agent of the current team and `guessesThisTurn ≥ 1`.
  * Settings and Start/Rematch are enabled for `isHost` only. Show *why* Start is disabled (same checks as `NOT_READY`).
* **Timer bar:** `remaining = turnEndsAt - (Date.now() + skew)`, where `skew = serverNow - Date.now()` measured at receipt.
  Tick sound in the last 10 s. The client never ends the turn itself; the server does that.
* **Errors:** show `ack.error.message` in the relevant `.note` element.
* **Connection states:** a banner showing "Waking the server…" (first connect can take up to 60 s on Render free),
  "Reconnecting…", and "Room closed".
* **Session:** keep `cnSession {code, playerId, token}` and rejoin on load or reconnect. Clear it on `room:leave` or `room:closed`.
* **Accessibility:** keep the ▲/●/✖/– marks, focus outlines, `role="status"` notes, and reduced-motion support.
* **Responsive:** must work at 360px; the board stays 5×5.

## Order of work (commit + push after each)

1. Pages workflow + `index.html` shell + CSS split from the prototype + router. The site goes live as a static page.
2. `config.js`, `net.js`, `state.js`, plus the "waking server" banner wired to `/health`.
3. Home + Profile (create/join with acks, session storage).
4. Lobby from `room:state`.
5. Board: grid, key view, clue form, guesses, end turn, timer, log.
6. Victory report, rematch.
7. Sound + theme + polish. Two-window test against the local backend, then against production.
8. Update `docs/STATUS.md`.
