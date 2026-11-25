# Backend guide (for the backend agent)

You own `backend/` and `render.yaml`. Read `AGENTS.md`, `docs/PROTOCOL.md` and `docs/RULES.md` first.

## Stack (fixed: don't swap it)

| Concern | Choice |
|---|---|
| Runtime | **Node.js 20 LTS** |
| Language | **TypeScript** (strict mode), compiled with `tsc` to `dist/` |
| HTTP | Express 4 (only `/health` and `/`) |
| Realtime | **Socket.IO 4** |
| Validation | `zod` for every incoming payload |
| Tests | **Vitest** (unit tests for rules, integration tests with `socket.io-client`) |
| Dev runner | `tsx watch` |
| Storage | **In memory** (a `Map<code, Room>`), no database. Rooms are short-lived; a restart just ends running games. |
| Hosting | **Render free web service** (see `docs/DEPLOY.md`) |

## Folder layout to create

```
backend/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore            node_modules, dist, .env
├── src/
│   ├── index.ts          Express + Socket.IO bootstrap, CORS, /health, PORT
│   ├── config.ts         env: PORT (default 3000), CORS_ORIGIN (comma list)
│   ├── types.ts          the types from PROTOCOL.md §4, copied exactly
│   ├── schemas.ts        zod schemas for every client payload
│   ├── words.ts          ≥ 400 UPPERCASE single words
│   ├── game.ts           PURE rule functions: newBoard, giveClue, guess, endTurn, computeStats …
│   ├── rooms.ts          RoomStore: create/join/leave, host transfer, cleanup, timers
│   ├── view.ts           buildView(room, playerId): RoomView. The ONLY place that decides who sees the key.
│   ├── handlers.ts       one function per socket event → validate → act → broadcast
│   └── errors.ts         GameError(code, message) + toAck()
└── test/
    ├── game.test.ts      rules: clue validation, guess limits, assassin, cleared, turn end
    ├── view.test.ts      key hidden from agents/spectators, shown to spymasters and after game over
    └── socket.test.ts    two-client end-to-end: create, join, seats, start, clue, guess
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "engines": { "node": ">=20" }
}
```

## Key implementation points

1. **Server-side state model** (internal, not sent as is):
   ```ts
   interface Room {
     code: string; hostId: string; phase: Phase; settings: Settings;
     players: Map<string, PlayerInternal>;   // PlayerInternal = Player + token + socketIds:Set + lastSeen
     words: string[]; key: Card[]; first: Team; turn: Team; turnNo: number;
     clue: Clue | null; guessesThisTurn: number; turnEndsAt: number | null;
     revealed: Map<number, Reveal>; log: Clue[]; over: RoomView['over'];
     timer: NodeJS.Timeout | null; createdAt: number; emptySince: number | null;
   }
   ```
2. **Broadcasting:** after every mutation call `broadcast(room)`, which loops over the players and sends each of
   their sockets its own `buildView(room, playerId)`. Don't use `io.to(room).emit('room:state', sameView)`,
   because spymasters and agents receive different views.
3. **Socket ↔ player:** keep `socket.data = { code, playerId }`. On `disconnect` mark the player `connected=false`
   when they have no sockets left, then broadcast.
4. **Codes:** 5 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ`, regenerated on collision. Tokens: `crypto.randomUUID()`.
   Player ids: `p_` + 8 random chars.
5. **Timer:** a single `setTimeout` per room set to `turnEndsAt`. Clear it and set it again on every turn change. On fire: end the turn,
   emit `room:event {kind:'timeout'}`, broadcast.
6. **Cleanup:** every 60 s, delete rooms that have had no connected player for 30 minutes (emit `room:closed`), and in the lobby,
   remove players who have been disconnected for more than 10 minutes.
7. **Validation:** each handler runs `schema.safeParse(payload)`, and on failure acks `BAD_REQUEST`. If the ack callback
   is missing, do nothing and never throw. Wrap every handler in try/catch → `toAck(err)`.
8. **Rate limit:** a simple per-socket token bucket, 20 events per second → `RATE_LIMITED`.
9. **CORS:** `new Server(http, { cors: { origin: config.corsOrigins } })`. Allow the GitHub Pages origin
   (`https://derbaliadem.github.io`) and the Expo web dev server (`http://localhost:8081`) by default.
   The Android and iOS apps send **no Origin header**, so never reject a connection just because Origin is missing.
10. **`/health`:** returns `{ ok: true, rooms, uptime }`. Render uses it as the health check, and the frontend uses it to wake the server.

## Order of work (commit + push after each)

1. Scaffold `package.json`, `tsconfig`, `/health`, and an empty Socket.IO server. Push it, so the frontend can connect.
2. `types.ts`, `words.ts`, `game.ts` + `game.test.ts`.
3. `rooms.ts`, `view.ts` + `view.test.ts`.
4. Handlers: `room:create`, `room:join` (with token reattach), `room:leave`, `profile:update`, `seat:*`, `settings:update`.
5. `game:start`, `clue:give`, `guess`, `turn:end`, `game:rematch`, `room:event` hints.
6. Timer, cleanup, rate limit.
7. `socket.test.ts`.
8. `render.yaml` + deploy (see `DEPLOY.md`). Write the live URL into `PROTOCOL.md` §1 if it differs from the one listed.
9. Update `docs/STATUS.md`.

## Testing locally with the frontend

`npm run dev`, then in `frontend/` run `npx expo start` and press `w`. Open the web app in two browser windows
(use a private window for the second player so it gets separate storage). To test with a real phone, run the server
on your LAN and start the app with `EXPO_PUBLIC_SERVER_URL=http://<LAN-IP>:3000`.
