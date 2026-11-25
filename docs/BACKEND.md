# Backend guide (for the backend agent)

You own `backend/` and `render.yaml`. Read `AGENTS.md`, `docs/PROTOCOL.md` and `docs/RULES.md` first.

## Stack (fixed: don't swap it)

| Concern | Choice |
|---|---|
| Runtime | **Node.js 22 LTS** (20 reached end of life in April 2026) |
| Language | **TypeScript** (strict mode), compiled with `tsc` to `dist/` |
| HTTP | Express 4 (only `/health` and `/`) |
| Realtime | **Socket.IO 4** |
| Validation | `zod` for every incoming payload |
| Tests | **Vitest** (unit tests for rules, integration tests with `socket.io-client`) |
| Dev runner | `tsx watch` |
| Storage | **In memory** (a `Map<code, Room>`), no database. Rooms are short-lived; a restart just ends running games. |
| Hosting | **Render free web service** (see `docs/DEPLOY.md`) |

## Folder layout

```
backend/
├── package.json
├── tsconfig.json         type-checks everything; tsconfig.build.json compiles src/ to dist/
├── eslint.config.js
├── vitest.config.ts
├── .env.example
├── .gitignore            node_modules, dist, .env
├── scripts/load.ts       load test
├── src/
│   ├── index.ts          process entry: signals, crash handling
│   ├── server.ts         wires HTTP, Socket.IO, rooms, housekeeping; start/stop
│   ├── http.ts           /health and /, headers, CORS
│   ├── config.ts         validated env (see .env.example)
│   ├── clientIp.ts       rate-limit key of a connection
│   ├── origin.ts         which origins may connect
│   ├── rateLimit.ts      token buckets
│   ├── logger.ts         JSON lines
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
    ├── rooms.test.ts     membership, host, seats, turn clock, clean-up
    ├── schemas.test.ts   payload validation
    ├── config.test.ts    env and rate limiters
    ├── socket.test.ts    multi-client end-to-end: rooms, lobby, whole games, clock
    ├── server.test.ts    HTTP, origins, limits, hostile clients, shutdown
    └── process.test.ts   the real process: health, bad config, port taken, SIGTERM
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=.env src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "check": "npm run lint && npm run typecheck && npm run build && npm test"
  },
  "engines": { "node": ">=22.12" }
}
```

## Key implementation points

1. **Server-side state model** (internal, not sent as is):
   ```ts
   interface Room {
     code: string; hostId: string; settings: Settings;
     players: Map<string, PlayerInternal>;   // PlayerInternal = Player + token + sockets:Set + lastSeen
     game: GameState;                        // immutable; replaced only through RoomStore.setGame (keeps the clock in step)
     turnEndsAt: number | null; cancelTimer: (() => void) | null;
     createdAt: number; emptySince: number | null;
   }
   interface GameState {                     // pure, from game.ts
     phase: Phase; words: string[]; key: Card[]; first: Team; turn: Team; turnNo: number;
     clue: Clue | null; guessesThisTurn: number;
     revealed: Map<number, Reveal>; log: Clue[]; over: RoomView['over'];
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
6. **Cleanup:** every 15 s, pass on the host role of hosts offline for 60 s, delete rooms that have had no connected player for 30 minutes (emit `room:closed`), and in the lobby,
   remove players who have been disconnected for more than 10 minutes.
7. **Validation:** each handler runs `schema.safeParse(payload)`, and on failure acks `BAD_REQUEST`. If the ack callback
   is missing, do nothing and never throw. Wrap every handler in try/catch → `toAck(err)`.
8. **Rate limit:** a per-socket token bucket, 20 events per second → `RATE_LIMITED` (200 in a row disconnect), plus
   per-address limits on room creation and wrong codes.
9. **CORS:** `new Server(http, { cors: { origin: config.corsOrigins } })`. Allow the GitHub Pages origin
   (`https://derbaliadem.github.io`) and the Expo web dev server (`http://localhost:8081`) by default.
   CORS doesn't cover WebSocket, so `allowRequest` checks the origin too (`origin.ts`). Native apps send no Origin, or the
   server's own address on React Native WebSockets: both must be accepted.
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
