# aSignOfWar

A multiplayer real-time strategy game inspired by browser-based strategy games like Tribal Wars (RO: Triburile), Travian, and Grepolis. Each player starts with a single city and develops it over time by constructing buildings, gathering resources, and training military units. Players form alliances and wage conquest wars against each other.

## Tech Stack

- **Backend:** Node.js + Express 5 + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Queue/Jobs:** Redis + BullMQ
- **Auth:** JWT + bcrypt
- **Validation:** Zod (request body validation on all endpoints)
- **CORS:** Configured for development (localhost:5173) and production (CLIENT_URL env var)

## Prerequisites

- Node.js
- PostgreSQL
- Redis

## Setup

1. Clone the repo and install dependencies:

```bash
cd server && npm install
cd ../client && npm install
```

2. Copy and configure environment variables (the `.env` file must live in `server/`):

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and fill in `DATABASE_URL`, `JWT_SECRET`, etc.

3. Run database migrations:

```bash
cd server
npx prisma migrate dev
```

4. Start the development server and client (two terminals):

```bash
# Terminal 1 - server
cd server && npm run dev

# Terminal 2 - client
cd client && npm run dev
```

Client runs on `http://localhost:5173`. Server runs on `http://localhost:3000`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `DATABASE_PASSWORD` | Database password | - |
| `JWT_SECRET` | Secret for signing JWT tokens | - |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NODE_ENV` | `development` or `production` | - |
| `GAME_SPEED` | Game speed multiplier (1 = normal) | `1` |
| `CLIENT_URL` | Frontend URL (production only) | - |

## Scripts

```bash
npm run dev      # Start in development mode (tsx watch, auto-reload)
npm run build    # Compile TypeScript
npm start        # Run compiled build
```

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register user + create starter city |
| POST | `/api/auth/login` | No | Login, returns JWT token |

### Buildings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/buildings/:buildingId/upgrade` | Yes | Start building upgrade |
| DELETE | `/api/buildings/orders/:orderId` | Yes | Cancel a pending building upgrade order (75% refund) |

### Cities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cities/mine?cityId=...` | Yes | Get city overview (buildings, units, resources, orders). `cityId` selects which owned city; defaults to oldest. Response includes `ownedCities[]` |
| PATCH | `/api/cities/mine/name` | Yes | Rename a city (`{ name, cityId? }`) |
| POST | `/api/cities/:cityId/recruit` | Yes | Start unit recruitment |
| DELETE | `/api/recruitment/orders/:orderId` | Yes | Cancel a pending recruitment order (75% refund) |

### Governor

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/governor` | Yes | Get account-wide governor progress: produced count, current deposits, next cost |
| POST | `/api/governor/deposit` | Yes | Deposit resources (`money`/`energy`/`ammo`) into the shared governor progress bars from any owned city |
| POST | `/api/governor/recruit` | Yes | Finalize recruitment once all three bars are full — spawns one GOVERNOR in the city that filled the last bar |

### Config

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/config` | No | Returns `shared/gameConfig` snapshot for the client (buildings, units, speed, travel constants) |

### Commands

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/cities/:cityId/commands` | Yes | Send attack / support / resources / spy command |
| GET | `/api/cities/:cityId/commands` | Yes | List outgoing and incoming commands |
| POST | `/api/cities/:cityId/commands/:commandId/cancel` | Yes | Cancel a TRAVELING command (5-minute window) |
| POST | `/api/cities/:cityId/commands/withdraw` | Yes | Withdraw stationed SUPPORT units home |

### Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports` | Yes | List battle / spy / support / resource reports for the user |
| DELETE | `/api/reports` | Yes | Hide all reports for the user |
| DELETE | `/api/reports/:id` | Yes | Hide a single report for the user |

### Map

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/map` | Yes | World map: grid size + all cities (coords, owner) |

Authentication uses Bearer tokens: `Authorization: Bearer <token>`

## Game Mechanics

### Buildings

9 building types, upgradeable to level 20-30. Each level increases cost and construction time exponentially.

| Building | Function | Max Level | HQ Required |
|----------|----------|-----------|-------------|
| HEADQUARTERS | Reduces construction time 2%/level | 30 | - |
| BANK | Produces Money | 30 | - |
| POWER_PLANT | Produces Energy | 30 | - |
| WEAPONS_FACTORY | Produces Ammo | 30 | - |
| HOUSING | Limits population (240–24000) | 30 | - |
| WAREHOUSE | Limits resource storage (1000–400000) | 30 | - |
| MILITARY_BASE | Unlocks units, speeds up recruitment | 25 | HQ 5 |
| HARBOR | Send resources to other cities | 25 | HQ 15 |
| AIR_DEFENSE | City defense | 20 | HQ 5 |

### Resources

- **Money** — produced by BANK
- **Energy** — produced by POWER_PLANT
- **Ammo** — produced by WEAPONS_FACTORY

Production rates increase per building level. Resources are synced lazily before any operation that reads or modifies them (no background worker needed).

### Units

11 unit types. Most are recruited from MILITARY_BASE; GOVERNOR and HACKER are recruited directly from HEADQUARTERS.

| Unit | Category | HQ Required | MB Required |
|------|----------|-------------|-------------|
| LIGHT_INFANTRY | Infantry | - | - |
| DEFENDER_INFANTRY | Infantry | 5 | - |
| HEAVY_INFANTRY | Infantry | - | - |
| SNIPER | Range | 10 | 10 |
| SPECIAL_FORCES | Range | 15 | 10 |
| RAIDER | Mechanized | 10 | - |
| TANK | Mechanized | 20 | 15 |
| MISSILE_LAUNCHER | Siege | 20 | 15 |
| DRONE | Siege | 20 | 20 |
| GOVERNOR | Conquer | 30 | - |
| HACKER | Spy | 10 | - |

### Commands

Players can send four types of commands between cities:

| Type | Description |
|------|-------------|
| ATTACK | Send units to attack another player's city |
| SUPPORT | Send units to reinforce a city — stationed units contribute to defense and can be withdrawn later |
| RESOURCES | Send resources to another city (requires HARBOR) |
| SPY | Send hackers to gather intel on another city |

Travel time is computed per command from the euclidean distance between the two cities and the speed of the slowest unit in the stack (Tribal Wars style):

```
distance           = sqrt((x2 - x1)² + (y2 - y1)²)     // in map fields
unit travel (sec)  = distance × slowestSpeed × 60 / GAME_SPEED   // speed is minutes-per-field
resource travel    = distance × 2 × 60 / GAME_SPEED              // HARBOR merchants are fast and uniform
```

See `RESOURCE_TRAVEL_MIN_PER_FIELD`, `getFieldDistance`, `getSlowestUnitSpeed`, `getUnitTravelTimeSec` and `getResourceTravelTimeSec` in `shared/gameConfig.ts`. After an attack resolves, surviving units return home with any stolen resources — the return trip is recomputed from the surviving slowest unit, so a wiped-out fast raid returns slower if only tanks survived. A TRAVELING command can be cancelled within the first 5 minutes of its trip — the units then return home symmetrically (same time elapsed already travelled).

#### Spy Mechanic

Only HACKER units participate in spy commands. Attacker sends N hackers; defender has D hackers (native + stationed as SUPPORT).

- If `N > D`: spy succeeds, `N - D` attacker hackers return home, defender hackers stay intact, and the attacker receives a snapshot of the target city's buildings and units.
- If `N <= D`: all attacker hackers die, defender is untouched, no snapshot is produced.

Defender hackers never die. The defender is never notified of a spy attempt (successful or not).

#### Battle Formula

Attacker losses are calculated per unit category (Infantry, Range, Mechanized):

```
loss_rate = (defender_force / attacker_force) ^ 1.5   [if attacker wins]
loss_rate = 1.0                                         [if attacker loses]
```

The overall winner is determined by comparing total attack force against the attack-weighted average of defender forces. AIR_DEFENSE level applies a defense bonus (4%–107%) to all defending units. MISSILE_LAUNCHER and DRONE deal wall damage before combat.

Attacking units that survive return home using the travel formula above.

#### Loyalty & Conquest

Each city starts at 100 loyalty. When an attack clears all defenders and contains at least one surviving GOVERNOR, loyalty is reduced by 20–35% per Governor (random roll). Loyalty is tracked on the `City` row and persists between attacks — repeated governor strikes wear a city down over time.

When loyalty drops to 0 or below, ownership transfers to the attacker: one GOVERNOR is consumed, loyalty resets to 100, the city is assigned to the attacker, and any stationed SUPPORT commands from third parties are displaced home (each with its own per-command return travel time). The surviving attacker stack that escorted the Governor does **not** merge into the new city — it stays garrisoned there as an `ARRIVED` SUPPORT command originating from the attacker's source city, so the units contribute to defense but remain under the source city's control and can be withdrawn normally.

### Reports

Players receive reports for battles (ATTACK), spy missions (SPY, attacker only), support arrivals / withdrawals (SUPPORT), and resource deliveries (RESOURCES). Reports are soft-hidden per user via `reportHiddenByAttacker` / `reportHiddenByDefender` flags, so the same underlying Command row can be dismissed independently by each side.

The client shows an unread badge on the Reports button, keyed per user via the JWT-derived user id so that different accounts in the same browser don't share read state.

### Client

The frontend is a React 19 + Vite + TailwindCSS SPA. Auth state is kept in a JWT stored in `localStorage`; protected routes redirect to `/login` otherwise.

| Route | Page | Purpose |
|-------|------|---------|
| `/login`, `/register` | `LoginPage`, `RegisterPage` | Auth forms |
| `/city` | `CityPage` | Main city view — buildings, resources, recruitment, reports |
| `/map` | `MapPage` | World map grid, pick targets, send commands |

Key UI building blocks under `client/src/components/`:

- `CityMap` — isometric-style city canvas rendering each building slot
- `BuildingsView` / `BuildingDetailView` — building list + upgrade panel
- `MilitaryBaseView` — recruitment UI for all 11 unit types
- `CityActionPanel` + `CommandDetailModal` — compose and inspect commands (attack / support / resources / spy)
- `ReportsView` — battle / spy / support / resource reports with unread badge keyed per user
- `ResourceBar` — live resource totals + production rates
- `SimulatorView` — offline battle calculator that reuses the shared `battleCalc.ts` formula, so the client can preview a fight without hitting the server

All game data (building costs, unit stats, production curves, battle formula) is imported from `shared/` so the client and server never drift.

### Multiple cities per account

A player's account can own any number of cities (starter city + conquered cities). One city is always marked as "active" on the client — the active id is stored in `localStorage` under `activeCityId` and mirrored into the URL as `?cityId=...` so a page reload keeps the same city selected. The active city drives every city-scoped request (`GET /api/cities/mine`, recruitment, building upgrades, commands).

UI affordances for multi-city accounts:

- `ResourceBar` renders a `▾` dropdown next to the city name when `ownedCities.length > 1`, listing all owned cities with coords and an active marker.
- On the map, clicking one of your own cities opens `CityActionPanel` with two buttons: **Select** (only switches the active city, stays on the map) and **Enter** (navigates into `/city`). The currently-active city shows neither button.
- A non-active owned city also gets **Support** / **Resources** buttons so you can reinforce or shuttle resources between your own cities. A city never offers these buttons against itself.
- Renaming a city uses `PATCH /api/cities/mine/name` with `{ name, cityId }`, so the right city is affected even when the active city is different from the one being renamed.

### Job Queue

Background jobs run via BullMQ + Redis:

- `building-upgrade` — completes building upgrades after the required time
- `unit-recruitment` — completes unit recruitment after the required time
- `command-travel` — processes command arrivals and return trips (including spy resolution and withdrawal returns)

## Project Structure

```
aSignOfWar/
├── shared/
│   └── gameConfig.ts          # Single source of truth for all game data
├── server/
│   ├── src/
│   │   ├── api/
│   │   │   ├── controllers/   # Request handlers
│   │   │   ├── routes/        # Route definitions
│   │   │   └── schemas.ts     # Zod validation schemas
│   │   ├── config/            # DB, Redis, game config wrapper, queues
│   │   ├── middleware/        # Auth + validation middleware
│   │   ├── services/          # Business logic
│   │   ├── workers/           # Background job processors
│   │   └── app.ts             # Entry point
│   └── prisma/
│       └── schema.prisma      # Database schema
├── client/                    # Frontend (React + Vite + TailwindCSS)
└── plan.txt                   # Game design document (RO)
```
