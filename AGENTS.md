# AGENTS.md – how the two agents work together

Two agents build this project at the same time in the same GitHub repository
(`https://github.com/DerbaliAdem/code-names-substitute`):

* **Frontend agent** – owns `frontend/` (React Native + Expo app, TypeScript) and `.github/workflows/pages.yml`.
* **Backend agent** – owns `backend/` (Node.js + TypeScript server) and `render.yaml`.

You can't talk to each other directly. **The repository is your only communication channel**,
so everything you decide has to be committed and pushed.

## 1. Ownership: never edit the other agent's folder

| Path | Who can edit it |
|---|---|
| `frontend/**` | Frontend agent only |
| `backend/**` | Backend agent only |
| `.github/workflows/pages.yml` | Frontend agent |
| `render.yaml` | Backend agent |
| `docs/PROTOCOL.md` | Both, following the change process in §4 |
| `docs/STATUS.md` | Both, but only your own section |
| `docs/FRONTEND.md` / `docs/BACKEND.md` | Their owner |
| `README.md`, `AGENTS.md`, `docs/RULES.md`, `docs/DEPLOY.md` | Both, small factual fixes only |

If you need something from the other side, write it in `docs/STATUS.md` under **Requests**.
Don't "just fix it" in their folder.

## 2. Branches and pushing

Pushing small and often is the whole point: the other agent can only see your work once it's pushed.

* Work directly on `main`. Commits are small and folders don't overlap, so feature branches aren't needed.
* **Before every piece of work:** `git pull --rebase origin main`
* **After every meaningful step** (a feature works, tests pass, a doc changed): commit **and push** right away.
  ```bash
  git add <your files>
  git commit -m "frontend: lobby screen renders room:state players"
  git pull --rebase origin main
  git push origin main
  ```
* If `push` is rejected, `pull --rebase` and push again. Never `push --force` to `main`.
* Never commit secrets, `node_modules/`, `dist/`, `.expo/` or `.env` files. Do commit `package-lock.json`.

## 3. Commit messages

Format: `<area>: <what changed, present tense>`, where area is `frontend`, `backend`, `protocol`, `docs` or `ci`.

Add a short body when the reason isn't obvious. Examples:

```
backend: enforce guess limit of clue number + 1
frontend: show "waking server" banner while Render cold-starts
protocol: add `connected` flag to Player (v1.1)
```

## 4. Changing the protocol (`docs/PROTOCOL.md`)

The protocol is the contract. Breaking it silently breaks the other agent.

1. **Additive changes** (a new optional field, a new event, a new error code): edit `PROTOCOL.md`,
   bump the minor version in its header (`1.0` → `1.1`), add a line to its **Changelog**,
   and commit with prefix `protocol:`. Then implement it on your side.
2. **Breaking changes** (renaming or removing a field or event, changing a meaning): don't edit
   the contract. Write a proposal under **Requests** in `docs/STATUS.md` and wait for the other agent to
   accept it there (they write "Accepted"). Then bump the major version.
3. The backend must tolerate unknown fields from clients, and the frontend must ignore unknown fields in `room:state`.

## 5. Status board (`docs/STATUS.md`)

Update your section at the end of every working session:

* **Done** – what is finished and pushed.
* **In progress** – what you're on now.
* **Blocked / Requests** – what you need from the other agent.

Read the other agent's section **every time you pull**.

## 6. Definition of done

* **Backend:** `npm run build` and `npm test` pass; every event in `PROTOCOL.md` is implemented with its acks and errors.
* **Frontend:** `npm run typecheck` and `npm run build:web` pass; a full game works against the local backend with two
  windows/devices; checked on web plus Android emulator, iOS simulator or Expo Go; usable at 360px width; light and dark themes readable.
* `docs/STATUS.md` is updated, and everything is committed **and pushed**.
