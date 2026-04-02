# aSignOfWar

A multiplayer real-time strategy game inspired by browser-based strategy games like Tribal Wars (RO: Triburile), Travian, and Grepolis. Each player starts with a single city and develops it over time by constructing buildings, gathering resources, and training military units. Players form alliances and wage conquest wars against each other.

## Tech Stack

- **Backend:** Node.js + Express 5 + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Queue/Jobs:** Redis + BullMQ
- **Auth:** JWT + bcrypt
- **Validation:** Zod

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

2. Copy and configure environment variables (`.env` trebuie să fie în `server/`):

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

## Scripts

```bash
npm run dev      # Start in development mode (tsx)
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

### Cities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cities/mine` | Yes | Get city overview (buildings, units, resources, orders) |
| POST | `/api/cities/:cityId/recruit` | Yes | Start unit recruitment |
| POST | `/api/cities/:cityId/commands` | Yes | Send attack / support / resources command |
| GET | `/api/cities/:cityId/commands` | Yes | List outgoing and incoming commands |

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

Production rates increase per building level. Resources are synced every 5 seconds via a background worker.

### Units

10 unit types recruitable from MILITARY_BASE (except GOVERNOR, recruited from HQ).

| Unit | Category | HQ Required | MB Required |
|------|----------|-------------|-------------|
| LIGHT_INFANTRY | Infantry | - | - |
| DEFENDER_INFANTRY | Infantry | 5 | - |
| ANTI_TANK_INFANTRY | Infantry | - | - |
| SNIPER | Range | 10 | 10 |
| SPECIAL_FORCES | Range | 15 | 10 |
| RAIDER | Mechanized | 10 | - |
| TANK | Mechanized | 20 | 15 |
| MISSILE_LAUNCHER | Siege | 20 | 15 |
| DRONE | Siege | 20 | 20 |
| GOVERNOR | Conquer | 30 | - |

### Commands

Players can send three types of commands between cities:

| Type | Description |
|------|-------------|
| ATTACK | Send units to attack another player's city |
| SUPPORT | Send units to reinforce a city |
| RESOURCES | Send resources to another city (requires HARBOR) |

All commands have a fixed travel time of 60 seconds (affected by `GAME_SPEED`). After an attack resolves, surviving units return home automatically with any stolen resources.

#### Battle Formula

Attacker losses are calculated per unit category (Infantry, Range, Mechanized):

```
loss_rate = (defender_force / attacker_force) ^ 1.5   [if attacker wins]
loss_rate = 1.0                                         [if attacker loses]
```

The overall winner is determined by comparing total attack force against the attack-weighted average of defender forces. AIR_DEFENSE level applies a defense bonus (4%–107%) to all defending units. MISSILE_LAUNCHER and DRONE deal wall damage before combat.

Attacking units that survive return home after another 60 seconds. If a GOVERNOR is in the attacking army and all defenders die, city loyalty is reduced by 20–35% per Governor.

### Job Queue

Background jobs run via BullMQ + Redis:

- `building-upgrade` — completes building upgrades after the required time
- `unit-recruitment` — completes unit recruitment after the required time
- `resource-tick` — syncs resource production every 5 seconds
- `command-travel` — processes command arrivals and return trips

## Project Structure

```
aSignOfWar/
├── server/
│   ├── src/
│   │   ├── api/
│   │   │   ├── controllers/   # Request handlers
│   │   │   └── routes/        # Route definitions
│   │   ├── config/            # DB, Redis, game config, queues
│   │   ├── middleware/        # Auth middleware
│   │   ├── services/          # Business logic
│   │   ├── workers/           # Background job processors
│   │   └── app.ts             # Entry point
│   └── prisma/
│       └── schema.prisma      # Database schema
├── client/                    # Frontend (WIP)
└── plan.txt                   # Game design document
```
