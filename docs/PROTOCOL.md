# Protocol – frontend ⇄ backend contract

**Version: 1.1** · Transport: **Socket.IO v4** (WebSocket, polling fallback) · Encoding: JSON

This file is the single source of truth. If the code and this file disagree, this file wins
and the code gets fixed. To change it, follow `AGENTS.md` §4.

---

## 1. Connection

| | Value |
|---|---|
| Local server | `http://localhost:3000` |
| Production server | `https://codenames-pulp-api.onrender.com` (update here if the Render name differs) |
| Socket.IO path | default (`/socket.io`) |
| Health check | `GET /health` → `200 {"ok":true,"rooms":<number>,"uptime":<seconds>}` |

Clients: one React Native (Expo) app that runs on **Android, iOS and web** (`frontend/src/net.ts`):

```ts
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
```

Native Android and iOS clients send **no `Origin` header**. CORS only applies to the web build, so the server must not
reject connections that have no `Origin`.

The free Render instance **sleeps after 15 minutes idle** and takes about 30–60 s to wake up.
The frontend should call `GET /health` on page load to start waking it, and show a "Waking the server…" state until the socket connects.

## 2. Request / response pattern

Every **client → server** event is sent **with an acknowledgement callback**:

```js
socket.emit('guess', { index: 7 }, (res) => {
  if (!res.ok) showError(res.error.message);
});
```

Every ack has this shape:

```ts
type Ack<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; error: { code: ErrorCode; message: string } };
```

`message` is a short English sentence that can be shown to the player as is.

After **any** change to a room, the server pushes a fresh `room:state` to **every** socket in that room,
including the sender. The frontend renders from `room:state` only. Don't update the UI from acks
(apart from showing errors and storing identity).

## 3. Identity and reconnection

* There are no accounts. When a player creates or joins a room, the server issues a `playerId` and a secret `token`.
* The app stores `{ code, playerId, token }` in AsyncStorage (localStorage on web) under key `cnSession`.
* On page load or socket reconnect, if `cnSession` exists, the frontend sends `room:join` with the same `code` and `token`.
  The server then reattaches the socket to the **same player** (same seat, same team) instead of creating a new one.
* A player whose socket disconnects stays in the room with `connected: false`. The server removes them
  from the room if they haven't reconnected within **10 minutes** during the lobby phase. During play they are kept, so they can come back.

## 4. Data types

```ts
type Team  = 'r' | 'b';                  // red, blue
type Role  = 'spymaster' | 'agent';
type Card  = 'r' | 'b' | 'n' | 'x';      // red, blue, neutral, assassin
type Phase = 'lobby' | 'play' | 'over';

interface Profile {                      // sent by the client, validated by the server
  name: string;     // 1–14 chars after trim; server falls back to "Agent"
  alias: string;    // ≤ 20 chars, free text (UI offers presets)
  color: string;    // "#rrggbb"
  badge: string;    // 1 emoji / symbol, ≤ 4 UTF-16 units
}

interface Player extends Profile {
  id: string;
  team: Team | null;
  role: Role | null;
  connected: boolean;
  isHost: boolean;
}

interface Reveal {
  type: Card;       // what the card turned out to be
  team: Team;       // team whose turn it was when it was tapped
  by: string;       // playerId
  clueId: string | null;
}

interface Clue {
  id: string;       // "c1", "c2", …
  word: string;     // UPPERCASE
  number: number;   // 0–9, 0 = unlimited guesses
  team: Team;
  by: string;       // playerId of the spymaster
  hits: number;     // own-team cards revealed under this clue (server computes)
}

interface Settings {
  timer: 0 | 45 | 90 | 150;   // seconds per turn, 0 = off
}

interface RoomView {          // what `room:state` carries – one per player
  code: string;               // 5 letters, A–Z without I and O
  phase: Phase;
  you: string;                // the receiving player's id
  players: Player[];          // in join order
  settings: Settings;
  words: string[];            // 25 words, index 0–24, row-major
  revealed: Record<number, Reveal>;   // only revealed cards
  key: Card[] | null;         // 25 entries. Only for spymasters during play, and for everyone when phase = 'over'. null otherwise.
  first: Team;                // team that started (has 9 cards)
  turn: Team;
  turnNo: number;             // starts at 1
  clue: Clue | null;          // active clue for the current turn, null while waiting for one
  guessesThisTurn: number;
  turnEndsAt: number | null;  // epoch ms (server clock), null if no timer
  serverNow: number;          // epoch ms when this view was built – use to correct clock skew
  remaining: { r: number; b: number };  // unrevealed cards per team
  log: Clue[];                // all clues, oldest first
  over: null | { winner: Team; reason: 'cleared' | 'assassin'; by: string };
  stats: null | {             // only when phase = 'over'
    turns: number;
    found: { r: number; b: number };
    topFinders: { playerId: string; count: number }[];  // up to 3, highest first
    bestClue: Clue | null;    // highest hits, null if none scored
  };
}
```

**Never** send the key to a non-spymaster during play. This is the main reason the backend exists.

## 5. Client → server events

| Event | Payload | Ack success fields | Allowed when |
|---|---|---|---|
| `room:create` | `{ profile: Profile }` | `{ code, playerId, token }` | always (leaves any current room first) |
| `room:join` | `{ code: string, profile: Profile, token?: string }` | `{ code, playerId, token }` | room exists. With a valid `token` it reattaches, otherwise it adds a new player. A new player can join during play but has no seat. |
| `room:leave` | `{}` | `{}` | in a room |
| `profile:update` | `{ profile: Profile }` | `{}` | in a room |
| `seat:take` | `{ team: Team, role: Role }` | `{}` | phase `lobby`, and the spymaster seat is free when role is `spymaster` |
| `seat:leave` | `{}` | `{}` | phase `lobby` |
| `settings:update` | `{ settings: Partial<Settings> }` | `{}` | phase `lobby`, host only |
| `game:start` | `{}` | `{}` | phase `lobby`, host only, each team has exactly 1 spymaster and ≥ 1 agent |
| `clue:give` | `{ word: string, number: number }` | `{}` | phase `play`, sender is the current team's spymaster, no active clue |
| `guess` | `{ index: number }` | `{ result: Card }` | phase `play`, sender is an agent of the current team, a clue is active, card not revealed |
| `turn:end` | `{}` | `{}` | phase `play`, sender is an agent of the current team, `guessesThisTurn ≥ 1` |
| `game:rematch` | `{}` | `{}` | phase `over`, host only. Returns to `lobby` with a new board; seats are kept. |

Host rule: the room creator is host. If the host leaves or is removed, host passes to the next player in join order.

## 6. Server → client events

| Event | Payload | When |
|---|---|---|
| `room:state` | `RoomView` | after every change, and right after a successful create or join |
| `room:closed` | `{ reason: string }` | the room was deleted (e.g. empty too long). The client clears `cnSession` and goes home. |
| `room:event` | `{ kind: 'reveal' \| 'clue' \| 'turn' \| 'timeout' \| 'start' \| 'over', data?: object }` | optional hint for sounds and animations, sent just before the matching `room:state`. The frontend must also work without it. |

## 7. Error codes

| Code | Meaning |
|---|---|
| `BAD_REQUEST` | payload missing or the wrong shape |
| `ROOM_NOT_FOUND` | no room with that code |
| `NOT_IN_ROOM` | the socket hasn't joined a room |
| `NOT_HOST` | only the host can do this |
| `WRONG_PHASE` | not allowed in the current phase |
| `SEAT_TAKEN` | that team already has a spymaster |
| `NOT_READY` | teams incomplete (message says which) |
| `NOT_YOUR_TURN` | it's the other team's turn, or you have the wrong role |
| `NO_CLUE` | agents can't guess before a clue is given |
| `CLUE_ACTIVE` | a clue was already given this turn |
| `INVALID_CLUE` | empty, more than one word, or it matches a board word (message says why) |
| `INVALID_NUMBER` | number out of 0–9, or greater than the team's remaining cards |
| `ALREADY_REVEALED` | card already revealed |
| `RATE_LIMITED` | more than 20 events per second from one socket |

## 8. Example flow

```
A: room:create {profile}               → ack {ok, code:"KPWRT", playerId:"p1", token:"…"}
A: ← room:state (phase lobby, 1 player)
B: room:join {code:"KPWRT", profile}   → ack {ok, …}
A,B: ← room:state (2 players)
… four players take seats with seat:take …
A: game:start                          → ack {ok}
all: ← room:event {kind:'start'}, room:state (phase play; spymasters get key[])
redSpy: clue:give {word:"OCEAN", number:2}
all: ← room:event {kind:'clue'}, room:state (clue set)
redAgent: guess {index:12}             → ack {ok, result:'r'}
all: ← room:event {kind:'reveal', data:{index:12, type:'r'}}, room:state
```

## Changelog

* **1.0** – initial contract.
* **1.1** – clients are now a React Native app (Android, iOS, web). Native clients have no `Origin` header. No payload changes.
