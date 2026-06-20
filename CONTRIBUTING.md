# Contributing to aSignOfWar

Thanks for your interest in contributing! aSignOfWar is an open-source,
browser-based strategy MMO, and contributions of all kinds are welcome — bug
reports, balance tweaks, new features, and documentation.

## Getting started

### Prerequisites

The quickest path is Docker. For local development without containers you'll
need Node, PostgreSQL, and Redis.

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker
  Engine + docker compose v2), **or**
- Node.js 20+ (CI runs Node 24), PostgreSQL 14+, and Redis 6+ for a manual setup

### Setup (Docker)

If you just want to run the game locally, clone this repo directly. If you plan
to submit changes, fork it first and clone your fork instead — see
[Code changes](#code-changes) for the full workflow.

```bash
git clone https://github.com/lauppv/aSignOfWar.git
cd aSignOfWar
cp server/.env.example server/.env
```

Edit `server/.env` and set real values for `DATABASE_PASSWORD` and `JWT_SECRET`
(everything else can stay as-is). Then build and start everything:

```bash
docker compose --env-file server/.env up --build
```

Open **http://localhost:3000** — the API and the client SPA are both served
there. For a manual (non-Docker) setup and the full environment-variable
reference, see [README.md](README.md#setup).

## Project structure

See [README.md](README.md#project-structure) for the full tree and
[ARCHITECTURE.md](ARCHITECTURE.md) for the design rules behind the layout. The
short version:

- `server/` — Express 5 + TypeScript API (Prisma → PostgreSQL, BullMQ → Redis)
- `client/` — React 18 + Vite + Tailwind frontend
- `shared/` — `gameConfig.ts` (game balance) and `battleCalc.ts` (battle
  formula), imported by both sides

## How to contribute

### Reporting bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS if relevant

### Balance and game design

Game balance lives in `shared/gameConfig.ts` — the single source of truth for
costs, times, and unit stats. Never hardcode a value in the server or client;
import it from there. The reasoning behind the numbers is documented in
`plan.txt`.

### Code changes

aSignOfWar uses the **fork-and-pull** model: push branches to your own fork,
then open a pull request against this repo.

1. Fork the repo on GitHub, clone your fork, and add this repo as `upstream`:
   ```bash
   git clone https://github.com/<your-username>/aSignOfWar.git
   cd aSignOfWar
   git remote add upstream https://github.com/lauppv/aSignOfWar.git
   ```
2. Create a feature branch from `main`: `git switch -c my-feature main`
3. Keep it up to date with upstream: `git fetch upstream && git rebase upstream/main`
4. Make your changes
5. Run the verification checks below — they must pass before you open a PR
6. Push to your fork (`git push origin my-feature`) and open a pull request
   against `lauppv/aSignOfWar` with a clear description of what changed and why

### Verifying changes

DB and Redis are mocked in the test suites, so no live services are needed. Run
these from each package directory:

```bash
# server/
npm install
npm run build           # tsc typecheck + emit
npm run test:coverage   # Vitest; fails under 90% coverage

# client/
npm install
npx tsc -b              # typecheck
npx vite build          # production bundle
npm run test:coverage   # Vitest; fails under 90% coverage
```

Both packages enforce a **90% coverage gate** (lines, branches, functions,
statements) over an explicit allow-list in each `vitest.config.ts`. CI
(`.github/workflows/ci.yml`) runs both gates on every pull request, so make sure
they pass locally first.

## Style guide

- **TypeScript everywhere**, strict mode.
- **Backend uses relative imports, never `@/` aliases.** `tsc` does not rewrite
  path aliases, so the built `node dist/server/src/app.js` would fail at runtime. Cross-module
  imports look like `../city/city.service`. (`@shared/*` is the one exception.)
- **Frontend uses the `@/` alias** (`@/features/...`, `@/shared/...`) plus
  `@shared/*` for the game config. Avoid `../../..` chains.
- **`shared/gameConfig.ts` is the single source of truth** for game balance —
  never hardcode a cost, time, or stat.
- **Error handling contract:** services `throw new Error("MACHINE_CODE")`;
  controllers map codes to HTTP; the client translates codes to human text in
  `client/src/shared/api/client.ts` (`humanizeError`). Add new codes there.
- **Zod** for all request validation.
- Existing code comments are partly in Romanian — match the surrounding language
  when editing a file; new top-level docs are in English.
- Default to no comments; only explain non-obvious *why*.

## Code of conduct

Be respectful. We're all here to build a fun game together.
