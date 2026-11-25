# Codenames Pulp

An online Codenames game in a pulp comic style. It runs on **Android, iOS and the web**.
Two teams, a 5×5 board, one secret key. One friend creates a room, the others join with a 5-letter code.

It's built by **two AI agents working in parallel** in this one repository:

| Part | Owner | Folder | Language / stack | Where it runs (free) |
|---|---|---|---|---|
| App (frontend) | **Frontend agent** | `frontend/` | **TypeScript + React Native (Expo)**, one codebase for Android, iOS and web | Web on **GitHub Pages**, Android **APK** via EAS, iOS via **Expo Go** |
| Server (backend) | **Backend agent** | `backend/` | **TypeScript + Node.js 20**, Express + **Socket.IO** | **Render** free web service |

Everything needed to play online is free. Publishing in the Google Play / Apple App Store is optional and costs
$25 once / $99 a year. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Start here

Every agent reads these, in this order, before writing code:

1. [`AGENTS.md`](AGENTS.md) – how the two agents collaborate (ownership, pushing, commits). **Mandatory.**
2. [`docs/PROTOCOL.md`](docs/PROTOCOL.md) – the contract between app and server. The single source of truth.
3. [`docs/RULES.md`](docs/RULES.md) – the game rules the server enforces.
4. Your own guide:
   - Frontend agent → [`docs/FRONTEND.md`](docs/FRONTEND.md)
   - Backend agent → [`docs/BACKEND.md`](docs/BACKEND.md)
5. [`docs/DEPLOY.md`](docs/DEPLOY.md) – how it goes online.
6. [`docs/STATUS.md`](docs/STATUS.md) – what each agent has done and needs.

## Architecture

```
 Android app ─┐
 iOS app ─────┼── same React Native code ── Socket.IO (wss) ──▶ Node.js server on Render
 Web browser ─┘   (frontend/)                 events + acks         (backend/)
                                              room:state pushes      rooms in memory
                                                                     game rules + timer
                                                                     secret key
```

* The **server is the authority**: it owns the board, the secret key, turns and the timer.
  The key is only sent to spymasters (and to everyone after the game ends), so agents can't cheat.
* The **app is a view**: it sends intents (`guess`, `clue:give` …) and renders whatever `room:state` the server pushes.

## Repository layout

```
/
├── README.md, AGENTS.md, CLAUDE.md
├── render.yaml                backend deploy blueprint (backend agent)
├── .github/workflows/pages.yml   builds the web app and deploys it to GitHub Pages
├── docs/
│   ├── PROTOCOL.md  RULES.md  FRONTEND.md  BACKEND.md  DEPLOY.md  STATUS.md
│   └── design/prototype.html  original single-file web design (visual reference only)
├── frontend/                  React Native + Expo app (frontend agent)
└── backend/                   Node.js server (backend agent)
```

## Run locally

```bash
# terminal 1 – server on http://localhost:3000
cd backend && npm install && npm run dev

# terminal 2 – app
cd frontend && npm install && npx expo start
#   press w for the web version, a for an Android emulator, i for the iOS simulator (macOS),
#   or scan the QR code with the free Expo Go app on your phone
```

On a real phone, point the app at your computer:
`EXPO_PUBLIC_SERVER_URL=http://<your-computer-LAN-IP>:3000 npx expo start`.
