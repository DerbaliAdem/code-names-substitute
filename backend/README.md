# backend/

Owned by the **backend agent**. Node.js 22 + TypeScript + Express + Socket.IO. The authoritative game server:
it implements `docs/PROTOCOL.md` and `docs/RULES.md`, and never trusts the client for rules or state.

```bash
npm install
npm run dev        # http://localhost:3000, reloads on change
npm run check      # lint + typecheck + build + tests (what CI runs)
npm run test:coverage
npm run load -- 500 20   # 500 four-player games for 20 s against a running server
```

Configuration is in [`.env.example`](.env.example). A wrong value stops the server at start-up with an explanation.

## Structure

| File | Responsibility |
|---|---|
| `src/game.ts` | Rules as pure functions `(state, actor, …) → state`. No I/O, no clock. |
| `src/rooms.ts` | `RoomStore`: rooms, players, host, seats, turn clock, clean-up. Doesn't know Socket.IO. |
| `src/view.ts` | What one player may see. **The only place that decides who gets the key.** |
| `src/schemas.ts` | zod schema of every client payload. |
| `src/handlers.ts` | Socket events: rate limit → validate → act → ack → broadcast. |
| `src/server.ts` | Wires HTTP, Socket.IO, store and housekeeping; start/stop. |
| `src/http.ts` | `/health` and `/`. |
| `src/config.ts`, `logger.ts`, `rateLimit.ts`, `clientIp.ts`, `origin.ts`, `errors.ts`, `types.ts`, `words.ts` | Support. |
| `src/index.ts` | Process entry: signals, crash handling. |

Time is injected (`now`, `schedule`), so tests drive the turn clock and clean-up without waiting.

## Security

* Server state decides everything; a payload is only an intent. Payloads are schema-checked and unknown fields dropped.
* The key leaves the server only through `view.ts`, for spymasters during play and for everyone after the game.
* Seats are tied to a secret random token. Tokens are sent only to their owner and never logged.
* Origin allow-list for HTTP, polling **and** WebSocket (CORS alone doesn't cover WebSocket). Native apps are accepted: they send
  no `Origin`, or the server's own address (React Native WebSockets).
* Limits: 20 events/s per socket (flooders are disconnected), 16 KB per message, room creation and wrong room codes
  per address, connections in total and per address, rooms, players per room.
* Clues are Unicode-normalised, so accents, punctuation, full-width letters or invisible characters can't smuggle in a board word.

## Limits by design

One process, rooms in memory: a restart ends running games (players get `room:closed`). To run several instances you would need
sticky routing by room code or a shared store; until then, **don't scale horizontally**.
