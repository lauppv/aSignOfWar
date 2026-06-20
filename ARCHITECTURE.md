# ARCHITECTURE.md

The design rules behind the layout in `CLAUDE.md`. Read this before adding a
module or moving code between layers.

## Guiding principle: feature-first, not layer-first

Both packages group code by **feature** (city, alliance, siege, …), not by
technical layer (all controllers together, all services together). A feature
folder holds everything you need to change that feature in one place, so a change
touches one directory instead of fanning out across `controllers/`, `services/`,
`schemas/`.

We deliberately did **not** adopt a framework (NestJS on the back, a meta-framework
on the front). Even at ~60 endpoints, manual feature-first layering stays easy to
follow and the decorator ceremony would cost more than it saves — see the note in
`server/src/app.ts`. The layering below is enforced by convention, not decorators.

## Project layout

```
aSignOfWar/
├── shared/                     # imported by both client and server (@shared/*)
│   ├── gameConfig.ts           # single source of truth: buildings, units, costs, speeds
│   └── battleCalc.ts           # battle formula (server combat + client simulator)
│
├── server/
│   ├── prisma/schema.prisma    # database schema (16 models, 7 enums)
│   ├── scripts/                # one-off admin/maintenance CLIs (seed, repack, cheats…)
│   ├── test.rest               # API-first endpoint tests (VS Code REST Client)
│   └── src/
│       ├── app.ts              # Express entry: route mounting, worker boot, ghost ticker
│       ├── core/               # process-wide singletons: db, env, redis, queue
│       ├── middleware/         # auth (JWT), validate (zod)
│       ├── modules/<feature>/  # feature-first: <f>.{routes,controller,service}.ts (+ .schema, .repository)
│       │   ├── auth/  building/  city/  command/  config/  governor/
│       │   ├── map/   message/   ranking/  recruitment/  report/
│       │   └── siege/ user/      alliance/
│       │   #  command/ also holds battle.service.ts (battle resolution)
│       │   #  map/     also holds ghost.service.ts + slotAllocator.ts
│       │   #  report/  also holds sharedReport.{service,controller}.ts
│       │   #  user/    also holds avatar.service.ts
│       └── workers/            # BullMQ consumers: building, recruitment, command, siege
│
├── client/
│   └── src/
│       ├── app/                # composition root: App, main, Layout, index.css
│       ├── features/<f>/       # api/ components/ context/ lib/ + <Feature>Page.tsx
│       │   #  auth city map rankings alliance messages reports siege simulator
│       └── shared/             # api/client, ui/, context/, lib/, hooks/, types/
│
├── Dockerfile                  # multi-stage build (fullstack | server targets)
├── docker-compose.yml          # app + Postgres + Redis
├── locustfile.py               # load test (Locust)
├── plan.txt                    # game design document
└── simulations.txt             # Tribal Wars battle references used for balancing
```

The rules behind this layout follow; the per-feature file naming
(`<feature>.routes.ts`, `<feature>.controller.ts`, …) is consistent across every
module.

## Backend

### Request flow

```
route  →  controller  →  service  →  Prisma (DB) + BullMQ (queues)
                                   ↘  repository (query-centric modules only)
workers (BullMQ consumers)  →  service        — async jobs land back in the same services
```

- **routes** — wire paths to controllers, attach `validate(schema)` and `auth`
  middleware. No logic.
- **controllers** — parse the request, call a service, map thrown `Error("CODE")`
  to an HTTP status. No business logic, no Prisma.
- **services** — the business logic. Own transactions, orchestration, game rules.
  This is where `throw new Error("MACHINE_CODE")` originates.
- **schema** (`<feature>.schema.ts`) — zod input schemas for that feature.
- **core/** — process-wide singletons: Prisma client, env, redis, BullMQ queues.
- **workers/** — BullMQ consumers. They stay under `src/workers/` (not inside a
  feature) because a worker is a separate runtime concern that pulls from several
  feature services; co-locating it with one feature would misrepresent that.

### Repository layer — only where it earns its place

`<feature>.repository.ts` exists for **query-centric** modules where the service
was mostly assembling Prisma reads: **city, ranking, user, message**. The
repository holds the raw `prisma.*` calls; the service keeps the
mapping/caching/business logic and calls named repository functions.

**Transactional / orchestration-heavy** modules keep Prisma **inside the
service**: **siege, command, governor, building, recruitment, alliance**. Their
work is multi-step writes inside `prisma.$transaction(...)`; splitting the queries
into a repository would either break atomicity or force the transaction client to
leak across the boundary. Keeping the orchestration whole is worth more than
uniformity. `city.service` is a hybrid: pure resource math + the transactional
`createStarterCity` stay in the service; routine reads/writes moved to the repo.

The rule: **add a repository when a module is dominated by reads you'd want to
reuse or test in isolation. Do not add one just for symmetry.**

### Cross-module imports

Feature services may import other feature services (e.g. `auth` → `city`/`map`,
`building` → `siege`). Use **relative** paths (`../city/city.service`) — never the
`@/` alias, because `tsc` does not rewrite aliases and the built `dist/` would fail
at runtime. `@shared/*` is the only alias the backend uses.

## Frontend

### Layout

```
client/src/
  app/               App, main, the Layout shell, index.css — composition root
  features/<f>/       api/  components/  context/  lib/  + <Feature>Page.tsx
  shared/            api/client  ui/  context/  lib/  hooks/  types/
```

- **features/** — a feature owns its page, its API service module (`api/<f>.ts`,
  thin wrappers over `shared/api/client`), its components, and any context/lib it
  alone uses.
- **shared/** — feature-agnostic building blocks: the HTTP client + error
  humanizer (`api/client.ts`), generic UI (`ui/`), cross-cutting React contexts
  (`TickContext`, `UnitInfoContext`), display labels and game-speed helpers
  (`lib/`), the shared domain types (`types/`).
- **app/** — the composition root: router, providers, and the `Layout` shell that
  stitches features together. `app/` may import from any feature; features should
  not import from `app/`.

### Imports

Frontend uses the `@/*` alias → `src/*` (resolved by both Vite and `tsc`), plus
`@shared/*` for the game config. Prefer `@/features/...` / `@/shared/...` over
`../../..` chains.

### Pragmatic exceptions (consistent with the backend's stance)

- **`shared/types/` stays one shared module.** The game domain model
  (`CityOverview`, `UnitName`, `BuildingName`, command/report shapes) is genuinely
  cross-feature. Splitting it per-feature would create churn and circular coupling
  for no real isolation win.
- **Cross-feature imports are allowed** where the UI is inherently cross-cutting
  (the city action panel reads alliance data; reports embed siege cards). We don't
  contort the tree to force zero cross-feature edges. `shared/lib/labels.ts` keeps
  two **type-only** imports from feature APIs — erased at compile time, no runtime
  coupling.

## The throughline

Group by feature; add a layer (repository, context, lib) only when a module
actually needs it. Uniformity is not a goal — locality of change and honest
boundaries are. When in doubt, keep related code together and avoid speculative
indirection (YAGNI).
