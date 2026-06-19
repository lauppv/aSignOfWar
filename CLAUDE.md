# CLAUDE.md

Guidance for working in this repo. **aSignOfWar** is a browser-based war/strategy
MMO: build a city, manage resources, recruit units, and attack/besiege other
players in real time.

## Stack

- **server/** — Express 5 + TypeScript (CommonJS). Prisma 5 → PostgreSQL.
  BullMQ + ioredis for async jobs. socket.io. JWT auth (bcrypt). zod validation.
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
- `npm start` — run the built server (`node dist/app.js`)
- `npm run db:migrate` / `db:reset` / `db:generate` — Prisma (build `DATABASE_URL`
  from the discrete `DATABASE_*` env vars via `db:url`)

### client/
- `npm run dev` — Vite dev server (proxies `/api` and `/uploads` → `localhost:3000`)
- `npm run build` — `tsc -b && vite build`
- `npm run preview` — preview the production build

### Verifying changes
There is no live DB/Redis in most working environments. The reliable green check is:
- server: `npm run build` (typecheck + emit)
- client: `npx tsc -b` (typecheck) and `npx vite build` (bundle)

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
  path aliases, so `node dist/app.js` would fail at runtime. Cross-module imports
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
