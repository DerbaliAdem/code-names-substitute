# Codenames Pulp (online)

An online Codenames game in a pulp comic style. Two teams, a 5×5 board, one secret key.
Friends open the site, one creates a room, the others join with a 5-letter code.

It is built by **two AI agents working in parallel** in this one repository:

| Part | Owner | Folder | Language / stack | Free hosting |
|---|---|---|---|---|
| Frontend | **Frontend agent** | `frontend/` | Plain HTML + CSS + JavaScript (ES modules, no build step), Socket.IO client from CDN | **GitHub Pages** |
| Backend | **Backend agent** | `backend/` | **Node.js 20 + TypeScript**, Express + **Socket.IO**, Vitest for tests | **Render** (free web service) |

Everything is free: GitHub Pages is free for public repos, Render's free web service needs no credit card.

## Start here

Every agent reads these, in this order, before writing code:

1. [`AGENTS.md`](AGENTS.md) – how the two agents collaborate (folders, branches, commits, pushing). **Mandatory.**
2. [`docs/PROTOCOL.md`](docs/PROTOCOL.md) – the contract between frontend and backend. The single source of truth.
3. [`docs/RULES.md`](docs/RULES.md) – the game rules the server enforces.
4. Your own guide:
   - Frontend agent → [`docs/FRONTEND.md`](docs/FRONTEND.md)
   - Backend agent → [`docs/BACKEND.md`](docs/BACKEND.md)
5. [`docs/DEPLOY.md`](docs/DEPLOY.md) – how it goes online for free.

## Architecture

```
 Browser (GitHub Pages)                         Render (Node.js)
 ┌────────────────────────┐   Socket.IO (wss)  ┌──────────────────────────┐
 │ frontend/index.html    │ ◀───────────────▶ │ backend/src/index.ts     │
 │  screens, animations,  │  events + acks     │  rooms in memory         │
 │  sound, theme          │  room:state pushes │  game rules (authority)  │
 └────────────────────────┘                    │  turn timer              │
                                               └──────────────────────────┘
```

* The **server is the authority**: it owns the board, the secret key, turns and the timer.
  The key is only ever sent to spymasters (and to everyone when the game is over), so agents cannot cheat by reading the page.
* The **frontend is a view**: it sends intents (`guess`, `clue:give` …) and renders whatever `room:state` the server pushes.

## Repository layout

```
/
├── README.md            this file
├── AGENTS.md            collaboration rules for both agents
├── CLAUDE.md            points agents to AGENTS.md
├── render.yaml          Render blueprint for the backend
├── .github/workflows/
│   └── pages.yml        deploys frontend/ to GitHub Pages on push to main
├── docs/
│   ├── PROTOCOL.md      frontend ⇄ backend contract
│   ├── RULES.md         game rules
│   ├── FRONTEND.md      frontend agent guide
│   ├── BACKEND.md       backend agent guide
│   ├── DEPLOY.md        free hosting setup
│   └── STATUS.md        progress board both agents update
├── frontend/            owned by the frontend agent
│   └── prototype.html   original single-file design (visual reference, do not ship)
└── backend/             owned by the backend agent
```

## Run locally

```bash
# terminal 1 – backend (http://localhost:3000)
cd backend && npm install && npm run dev

# terminal 2 – frontend (http://localhost:5173)
cd frontend && npx serve -l 5173 .
```

The frontend talks to `http://localhost:3000` automatically when opened on `localhost`.
