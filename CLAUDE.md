# CLAUDE.md

Guidance for working in this repo. **aSignOfWar** is a browser-based war/strategy
MMO: build a city, manage resources, recruit units, and attack/besiege other
players in real time.

The full game-design spec — mechanics, buildings, units, formulas, and the
rationale behind them — lives in `plan.txt`. `shared/gameConfig.ts` holds the
actual balance values; `plan.txt` explains the *why*.

## Stack

- **server/** — Express 5 + TypeScript (CommonJS). Prisma 5 → PostgreSQL.
  BullMQ + ioredis for async jobs. JWT auth (bcrypt). zod validation.
- **client/** — React 18 + Vite 5 + TypeScript. Tailwind 4. TanStack Query 5.
  react-router-dom 6.
- **shared/** — `gameConfig.ts` (game balance: costs, times, unit stats — the
  single source of truth) and `battleCalc.ts` (battle resolution, used by both
  the server and the client-side simulator). Imported as `@shared/*` on both sides.

## Commands

Run these from the relevant package directory.

### server/
- `npm run dev` — watch mode (`tsx watch src/app.ts`)
- `npm run build` — `tsc` → `dist/`
- `npm start` — run the built server (`node dist/server/src/app.js`)
- `npm run db:migrate` / `db:reset` / `db:generate` — Prisma (build `DATABASE_URL`
  from the discrete `DATABASE_*` env vars via `db:url`)

### client/
- `npm run dev` — Vite dev server (proxies `/api` and `/uploads` → `localhost:3000`)
- `npm run build` — `tsc -b && vite build`
- `npm run preview` — preview the production build

### Tests (Vitest)
Both packages run Vitest with a **90% coverage gate** (lines/branches/functions/
statements) enforced over an explicit allow-list in each `vitest.config.ts`.
- `npm test` — run the suite once
- `npm run test:watch` — watch mode
- `npm run test:coverage` — run with coverage; fails under 90%

The server suite runs in Node and also covers `shared/` (pure game logic); the
client suite runs in jsdom. DB/Redis are mocked, so no live services are needed.
A file is only under the gate once it has tests — grow `coverage.include` as you
add suites. CI (`.github/workflows/ci.yml`) runs both gates on every PR.

### Verifying changes
There is no live DB/Redis in most working environments. The reliable green check is:
- server: `npm run build` (typecheck + emit) and `npm run test:coverage`
- client: `npx tsc -b` (typecheck), `npx vite build` (bundle), and `npm run test:coverage`

Run these after edits. They are the project's safety net.

## Layout

```
server/src/
  app.ts                 Express entry: mounts routes, registers workers, ghost ticker
  core/                  db (Prisma client), env, redis, queue (BullMQ)
  middleware/            auth (JWT), validate (zod)
  modules/<feature>/     <feature>.{routes,controller,service}.ts (+ .schema, .repository)
  workers/               BullMQ consumers (building, recruitment, command, siege)
client/src/
  app/                   App, main, Layout shell, index.css
  features/<feature>/    api/, components/, context/, lib/ + the feature's page
  shared/                api/client, ui/, context/, lib/, hooks/, types/
shared/                  gameConfig.ts, battleCalc.ts (used by both server & client)
```

See `ARCHITECTURE.md` for the design rules behind this layout.

## Conventions (read before editing)

- **Backend uses RELATIVE imports, never `@/` aliases.** `tsc` does not rewrite
  path aliases, so `node dist/server/src/app.js` would fail at runtime. Cross-module imports
  look like `../city/city.service`. (The `@shared/*` alias is the one exception and
  is configured for ts-node/tsx + the build.)
- **Frontend uses the `@/` alias** (`@/features/...`, `@/shared/...`) — Vite and
  `tsc` resolve it. Plus `@shared/*` for the game config. Avoid `../../..` chains.
- **`shared/gameConfig.ts` is the single source of truth** for game balance. Never
  hardcode a cost/time/stat in server or client — import it from there.
- **Error handling contract:** services `throw new Error("MACHINE_CODE")`;
  controllers map codes to HTTP; the client translates codes to human text in
  `client/src/shared/api/client.ts` (`humanizeError`). Add new codes there.
- Existing code comments are partly in Romanian — match the surrounding language
  when editing a file, but new top-level docs are in English.
- Default to no comments; only explain non-obvious *why*.

## Env

Server reads `server/.env` (see `server/.env.example`). `env.ts` builds
`DATABASE_URL` from the discrete `DATABASE_*` vars at runtime. Required:
`DATABASE_HOST/NAME/USER/PASSWORD`, `JWT_SECRET`, `REDIS_URL`. Never commit `.env`.

## Git

- Work on a branch; open a PR — do not push to `main` directly.
- `server/dist/` and `client/dist/` are gitignored; don't commit build output.
