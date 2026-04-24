# aSignOfWar

A multiplayer real-time strategy game inspired by browser-based strategy games like Tribal Wars (RO: Triburile), Travian, and Grepolis. Each player starts with a single city and develops it over time by constructing buildings, gathering resources, and training military units. Players form alliances and wage conquest wars against each other.

> **Note:** This is a portfolio project. This README intentionally includes detailed API endpoints, database schema, game mechanics, and architecture decisions that would normally live in internal documentation — the goal is to give reviewers a complete picture of the system without having to dig through the code.

## Table of contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Admin Scripts](#admin-scripts)
- [Resetting the world](#resetting-the-world)
- [Playing with friends (ngrok)](#playing-with-friends-ngrok)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Game Mechanics](#game-mechanics)
  - [Buildings](#buildings)
  - [Resources](#resources)
  - [Units](#units)
  - [Commands](#commands)
  - [Battle Formula](#battle-formula)
  - [Spy Mechanic](#spy-mechanic)
  - [Loyalty and Conquest](#loyalty-and-conquest)
  - [Battle Simulator](#battle-simulator)
  - [Ghost Cities](#ghost-cities)
  - [Multiple Cities](#multiple-cities)
  - [Alliances](#alliances)
  - [Messages](#messages)
  - [Report Sharing](#report-sharing)
- [Job Queue (BullMQ)](#job-queue-bullmq)
- [Load Testing](#load-testing)
  - [Results (500 users)](#results-500-concurrent-users-spawn-rate-5-13s-think-time)
  - [Extended run (600 users)](#extended-run-600-concurrent-users-spawn-rate-1-12-minutes)
  - [Performance optimizations](#performance-optimizations)
- [Architecture Decisions](#architecture-decisions)

## Features

- **Interactive city view** — isometric city image with clickable polygon hitboxes over each building slot, opening building details directly from the map
- **City management** — 9 building types, 3 resource economies, population system, upgrade queues
- **11 military units** across 6 categories (infantry, range, mechanized, siege, conquer, spy) with rock-paper-scissors defense mechanics
- **Real-time combat** — category-weighted battle formula shared between server and client-side battle simulator
- **Spy intelligence** — hacker-vs-hacker system separate from combat, with city snapshots on success
- **City conquest** — governor-based loyalty siege across multiple attacks
- **Alliance system** — creation, invitations, applications, chat, member management, leaderboards
- **World map** — 300x300 grid with ghost NPC cities for early-game farming
- **Direct messages** with embedded shared battle/spy reports
- **Load tested** — 500 concurrent users at ~218 req/s with ~0.01% failure rate (Locust)

### Screenshots
These screenshots were taken with GAME_SPEED=600 (see server/.env) for testing purposes, which is why the construction and recruitment times are so short. Normally, at speed 1, for example, constructions take hours, and recruitment—depending on the quantity—can take days.

| City dashboard | World map |
|:-:|:-:|
| ![City dashboard](screenshots/city.png) | ![World map](screenshots/map.png) |

| Headquarters | Military base |
|:-:|:-:|
| ![Headquarters](screenshots/buildings.png) | ![Military base](screenshots/military-base.png) |

| Unit info | Air defense |
|:-:|:-:|
| ![Unit info](screenshots/unit-info.png) | ![Air defense](screenshots/air-defense.png) |

| Power plant | Weapons factory |
|:-:|:-:|
| ![Power plant](screenshots/power-plant.png) | ![Weapons factory](screenshots/weapons-factory.png) |

| Harbor | Warehouse |
|:-:|:-:|
| ![Harbor](screenshots/harbor.png) | ![Warehouse](screenshots/warehouse.png) |

## Tech Stack

**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query 5 + React Router 6

**Backend:** Node.js + Express 5 + TypeScript + Prisma 5 (PostgreSQL) + BullMQ (Redis) + Zod 4

**Auth:** JWT (jsonwebtoken) + bcrypt

**File uploads:** Multer (player/alliance avatars, stored in `server/uploads/`)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/) (v14+)
- [Redis](https://redis.io/) (v6+)

### Installing prerequisites

**Ubuntu/Debian:**

```bash
# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
```

**macOS (Homebrew):**

```bash
brew install node postgresql@14 redis
brew services start postgresql@14
brew services start redis
```

**Windows:** Install Node.js from the official site, PostgreSQL from the installer at postgresql.org, and Redis via WSL2 or Memurai.

### Setting up the database

```bash
sudo -u postgres psql
```

```sql
CREATE USER asow WITH PASSWORD 'your_password';
CREATE DATABASE asow OWNER asow;
\q
```

## Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/lauppv/aSignOfWar
cd aSignOfWar

cd server
npm install
cd ..

cd client
npm install
cd ..
```

2. Copy and configure environment variables (the `.env` file must live in `server/`):

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=asow
DATABASE_USER=asow
DATABASE_PASSWORD=your_silly_password_here

JWT_SECRET=strong_secret_key_here
REDIS_URL=redis://localhost:6379
NODE_ENV=development
GAME_SPEED=1
```

3. Run database migrations and generate Prisma client:

```bash
cd server
npx prisma migrate dev
cd ..
```

4. Start the development server and client (two terminals):

```bash
# Terminal 1 — server
cd server
npm run dev

# Terminal 2 — client
cd client
npm run dev
```

Client runs on `http://localhost:5173`. Server runs on `http://localhost:3000`.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `DATABASE_HOST` | PostgreSQL host | Yes | — |
| `DATABASE_PORT` | PostgreSQL port | No | `5432` |
| `DATABASE_NAME` | Database name | Yes | — |
| `DATABASE_USER` | Database user | Yes | — |
| `DATABASE_PASSWORD` | Database password | Yes | — |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes | — |
| `REDIS_URL` | Redis connection string | Yes | — |
| `NODE_ENV` | `development` or `production` | No | `development` |
| `GAME_SPEED` | Game speed multiplier (1 = normal, higher = faster) | No | `1` |
| `CLIENT_URL` | Frontend URL (production CORS origin) | Production only | — |

## Admin Scripts

Located in `server/scripts/`, run from the `server/` directory:

```bash
npx tsx scripts/dev-cheats.ts <command> [args]   # Dev cheats (refill resources, set units, etc.)
npx tsx scripts/seed-ghosts.ts                   # Seed ghost cities around existing players
npx tsx scripts/repack-map.ts                    # Re-arrange all cities in a spiral layout
npx tsx scripts/backfill-ghost-buildings.ts       # Backfill buildings for legacy ghost cities
npx tsx scripts/resolve-stuck-commands.ts         # Re-queue stuck TRAVELING commands
```

## Resetting the world

To wipe all data and start fresh (like a new world in Tribal Wars):

```bash
cd server
npx prisma migrate reset    # Drops all tables, re-runs migrations — empty DB, schema intact
redis-cli FLUSHDB           # Clears BullMQ job queues
```

## Playing with friends (ngrok)

You can host the game locally and let friends on different networks join via [ngrok](https://ngrok.com/). The server serves the built client as static files, so only one tunnel is needed.

1. Build the client:

```bash
cd client
npm run build
cd ..
```

2. Start the server:

```bash
cd server
npm run dev
```

3. Start ngrok:

```bash
ngrok http 3000
```

4. Share the ngrok URL (e.g. `https://abc123.ngrok-free.app`) with your friends. They open it in a browser and register/play normally.

The ngrok URL is random and unlisted — only people you share it with can access the game. For extra security, ngrok supports basic auth (`ngrok http 3000 --basic-auth="user:password"`) or IP restrictions on paid plans.

## Project Structure

```
aSignOfWar/
├── shared/                            # Shared code (imported by both client and server)
│   ├── gameConfig.ts                  # Single source of truth: buildings, units, costs, speeds
│   └── battleCalc.ts                  # Battle formula (used server-side + client simulator)
│
├── server/
│   ├── prisma/
│   │   └── schema.prisma              # Database schema (15 models, 6 enums)
│   ├── scripts/                       # One-off admin/maintenance scripts
│   │   ├── dev-cheats.ts              # Dev CLI: refill, setUnits, setBuilding, maxAll, etc.
│   │   ├── seed-ghosts.ts             # Seed ghost cities around players
│   │   ├── repack-map.ts             # Re-arrange city positions on the map
│   │   ├── backfill-ghost-buildings.ts # Backfill buildings for legacy ghosts
│   │   └── resolve-stuck-commands.ts  # Re-queue stuck commands
│   ├── src/
│   │   ├── app.ts                     # Express entry point, route mounting, worker boot
│   │   ├── config/
│   │   │   ├── db.ts                  # Prisma client singleton
│   │   │   ├── env.ts                 # Environment variable loader + validation
│   │   │   ├── redis.ts               # IORedis connection
│   │   │   └── queue.ts              # BullMQ queue definitions
│   │   ├── middleware/
│   │   │   ├── auth.ts                # JWT verification, attaches userId to request
│   │   │   └── validate.ts            # Zod schema validation middleware
│   │   ├── api/
│   │   │   ├── schemas.ts             # Zod schemas for all request bodies
│   │   │   ├── controllers/           # Request handlers (13 controllers)
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── building.controller.ts
│   │   │   │   ├── city.controller.ts
│   │   │   │   ├── command.controller.ts
│   │   │   │   ├── governor.controller.ts
│   │   │   │   ├── map.controller.ts
│   │   │   │   ├── ranking.controller.ts
│   │   │   │   ├── recruitment.controller.ts
│   │   │   │   ├── report.controller.ts
│   │   │   │   ├── sharedReport.controller.ts
│   │   │   │   ├── alliance.controller.ts
│   │   │   │   ├── message.controller.ts
│   │   │   │   └── user.controller.ts
│   │   │   └── routes/                # Route definitions (13 route files)
│   │   │       ├── auth.routes.ts
│   │   │       ├── building.routes.ts
│   │   │       ├── city.routes.ts
│   │   │       ├── command.routes.ts
│   │   │       ├── config.routes.ts
│   │   │       ├── governor.routes.ts
│   │   │       ├── map.routes.ts
│   │   │       ├── ranking.routes.ts
│   │   │       ├── recruitment.routes.ts
│   │   │       ├── report.routes.ts
│   │   │       ├── alliance.routes.ts
│   │   │       ├── message.routes.ts
│   │   │       └── user.routes.ts
│   │   ├── services/                  # Business logic (16 services)
│   │   │   ├── auth.service.ts        # Register, login, password hashing
│   │   │   ├── building.service.ts    # Building upgrades, cancel, queue scheduling
│   │   │   ├── city.service.ts        # City overview, resource sync, rename
│   │   │   ├── recruitment.service.ts # Unit recruitment, cancel, queue scheduling
│   │   │   ├── command.service.ts     # Send/cancel commands, travel time calculation
│   │   │   ├── battle.service.ts      # Battle resolution, loot, loyalty, conquest
│   │   │   ├── governor.service.ts    # Governor deposit/recruit (account-wide)
│   │   │   ├── map.service.ts         # World map, city placement, ghost city spawning
│   │   │   ├── slotAllocator.ts      # In-memory slot allocator with async mutex
│   │   │   ├── ghost.service.ts       # Ghost city auto-upgrade ticker
│   │   │   ├── ranking.service.ts     # Player and alliance leaderboards
│   │   │   ├── report.service.ts      # Battle/spy/support/resource report queries
│   │   │   ├── sharedReport.service.ts # Report sharing with visibility options
│   │   │   ├── alliance.service.ts    # Alliance CRUD, invites, applications, chat
│   │   │   ├── message.service.ts     # Direct messages between players
│   │   │   ├── user.service.ts        # Player profiles, description, search
│   │   │   └── avatar.service.ts      # Avatar upload (player + alliance)
│   │   └── workers/                   # BullMQ job processors
│   │       ├── building.worker.ts     # Completes building upgrades
│   │       ├── recruitment.worker.ts  # Completes unit recruitment
│   │       └── command.worker.ts      # Processes command arrivals and returns
│   └── uploads/                       # Avatar file storage (gitignored)
│
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                   # React entry point
│       ├── App.tsx                    # Router, context providers, route definitions
│       ├── index.css                  # Tailwind imports
│       ├── types/
│       │   └── index.ts              # Shared TypeScript types (API responses, game entities)
│       ├── api/                       # API client functions (fetch wrappers)
│       │   ├── client.ts             # Base fetch wrapper, auth token, error handling
│       │   ├── auth.ts               # Login, register
│       │   ├── city.ts               # City data, rename
│       │   ├── command.ts            # Send/cancel/list commands
│       │   ├── map.ts                # World map data
│       │   ├── report.ts            # Reports CRUD + sharing
│       │   ├── ranking.ts           # Leaderboard queries
│       │   ├── governor.ts          # Governor deposit/recruit
│       │   ├── alliance.ts          # Alliance CRUD, invites, applications, chat
│       │   ├── message.ts           # Direct messages
│       │   └── user.ts              # Player profiles, avatar upload
│       ├── context/                   # React context providers
│       │   ├── TickContext.tsx        # Real-time clock (1s tick) for countdowns
│       │   ├── UnitInfoContext.tsx    # Unit info modal (click any unit icon)
│       │   ├── PlayerProfileContext.tsx   # Player profile modal
│       │   └── AllianceProfileContext.tsx # Alliance profile modal
│       ├── hooks/
│       │   └── useClickOutside.ts    # Click-outside + Escape key hook
│       ├── lib/                       # Shared utilities
│       │   ├── labels.ts            # Display names, colors, unit/building order
│       │   ├── cityHelpers.ts       # Helper functions for city data
│       │   └── gameSpeed.ts         # Loads game speed from server config
│       ├── pages/                     # Route-level page components
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── CityPage.tsx          # Main city dashboard (buildings, units, commands)
│       │   ├── MapPage.tsx           # World map (scrollable grid, city selection)
│       │   ├── RankingsPage.tsx      # Player and alliance leaderboards
│       │   ├── AlliancePage.tsx      # Alliance management (members, chat, settings)
│       │   └── MessagesPage.tsx      # Direct messages between players
│       └── components/                # Reusable UI components
│           ├── Layout.tsx            # Authenticated layout (nav bar, resource bar)
│           ├── ResourceBar.tsx       # Live resource totals + production rates + city switcher
│           ├── CityMap.tsx           # Isometric city canvas (building slots)
│           ├── BuildingsView.tsx     # Building list
│           ├── BuildingDetailView.tsx # Building upgrade panel
│           ├── MilitaryBaseView.tsx  # Unit recruitment UI
│           ├── UnitCard.tsx          # Single unit display card
│           ├── UnitInfoModal.tsx     # Unit stats popup
│           ├── CityActionPanel.tsx   # Map command composer (attack/support/resources/spy)
│           ├── CommandDetailModal.tsx # Command inspection modal
│           ├── CancelCommandConfirm.tsx # Command cancel confirmation
│           ├── ReportsView.tsx       # Battle/spy/support/resource reports
│           ├── SimulatorView.tsx     # Offline battle calculator
│           ├── PlayerProfileModal.tsx # Player profile (stats, cities, avatar)
│           ├── AllianceProfileModal.tsx # Alliance profile
│           ├── MessageContent.tsx    # Message rendering (shared reports, rich text)
│           └── ConfirmModal.tsx      # Generic confirmation dialog
├── screenshots/                       # README screenshots (city, map, buildings, units)
├── plan.txt                           # Game design document (Romanian)
├── simulations.txt                    # Tribal Wars battle simulations used as reference for balancing
└── locustfile.py                      # Load test (Locust) — simulates concurrent players
```

## API Endpoints

Authentication uses Bearer tokens: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register user + create starter city + spawn ghost cities nearby |
| POST | `/api/auth/login` | No | Login, returns JWT token |

### Cities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cities/mine?cityId=...` | Yes | City overview (buildings, units, resources, orders). Defaults to oldest owned city. Response includes `ownedCities[]` |
| PATCH | `/api/cities/mine/name` | Yes | Rename a city (`{ name, cityId? }`) |

### Buildings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/buildings/:buildingId/upgrade` | Yes | Start building upgrade (queued via BullMQ) |
| DELETE | `/api/buildings/orders/:orderId` | Yes | Cancel a pending upgrade order (75% refund) |

### Recruitment

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/cities/:cityId/recruit` | Yes | Start unit recruitment |
| DELETE | `/api/recruitment/orders/:orderId` | Yes | Cancel a pending recruitment order (75% refund) |

### Governor

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/governor` | Yes | Governor progress: produced count, current deposits, next cost |
| POST | `/api/governor/deposit` | Yes | Deposit resources into shared governor progress bars from any city |
| POST | `/api/governor/recruit` | Yes | Finalize recruitment once all three bars are full |

### Commands

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/cities/:cityId/commands` | Yes | Send attack / support / resources / spy command |
| GET | `/api/cities/:cityId/commands` | Yes | List outgoing and incoming commands |
| POST | `/api/cities/:cityId/commands/:commandId/cancel` | Yes | Cancel a TRAVELING command (5-minute window) |
| POST | `/api/cities/:cityId/commands/withdraw` | Yes | Withdraw stationed SUPPORT units home |

### Map

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/map` | Yes | World map: grid size + all cities (coords, owner, alliance) |

### Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports` | Yes | List all reports for the user |
| DELETE | `/api/reports` | Yes | Hide all reports |
| DELETE | `/api/reports/:id` | Yes | Hide a single report |
| POST | `/api/reports/:commandId/share` | Yes | Create a shared report link (with visibility options) |
| GET | `/api/reports/shared/:id` | Yes | View a shared report |

### Rankings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rankings` | Yes | Player leaderboard (points, kills, loot) |
| GET | `/api/rankings/alliances` | Yes | Alliance leaderboard |

### Alliances

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/alliances` | Yes | List all alliances |
| POST | `/api/alliances` | Yes | Create an alliance |
| PATCH | `/api/alliances` | Yes | Update alliance settings (name, tag, access mode) |
| GET | `/api/alliances/me` | Yes | Get own alliance details |
| POST | `/api/alliances/leave` | Yes | Leave current alliance |
| POST | `/api/alliances/disband` | Yes | Disband alliance (leader only) |
| POST | `/api/alliances/invite` | Yes | Invite player by username |
| GET | `/api/alliances/invitations` | Yes | List alliance's pending invitations (leader) |
| DELETE | `/api/alliances/invitations/:id` | Yes | Cancel an invitation |
| POST | `/api/alliances/invitations/:id/accept` | Yes | Accept an invitation |
| POST | `/api/alliances/invitations/:id/reject` | Yes | Reject an invitation |
| GET | `/api/alliances/me/invitations` | Yes | List invitations received by the user |
| GET | `/api/alliances/me/application` | Yes | Get own pending application |
| POST | `/api/alliances/me/application/cancel` | Yes | Cancel own application |
| GET | `/api/alliances/applications` | Yes | List applications to your alliance (leader) |
| POST | `/api/alliances/applications/:id/accept` | Yes | Accept an application |
| POST | `/api/alliances/applications/:id/reject` | Yes | Reject an application |
| POST | `/api/alliances/members/:id/kick` | Yes | Kick a member (leader only) |
| POST | `/api/alliances/members/:id/transfer` | Yes | Transfer leadership |
| GET | `/api/alliances/messages/unread` | Yes | Check for unread alliance messages |
| GET | `/api/alliances/messages` | Yes | List alliance chat messages |
| POST | `/api/alliances/messages` | Yes | Post alliance chat message |
| DELETE | `/api/alliances/messages/:id` | Yes | Delete an alliance message (leader) |
| POST | `/api/alliances/:id/avatar` | Yes | Upload alliance avatar |
| GET | `/api/alliances/:id/profile` | Yes | Get alliance profile (public) |
| GET | `/api/alliances/:id` | Yes | Get alliance details |
| POST | `/api/alliances/:id/join` | Yes | Join an open alliance |
| POST | `/api/alliances/:id/apply` | Yes | Submit application to an alliance |

### Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/messages/direct/unread` | Yes | Count unread direct messages |
| GET | `/api/messages/direct/conversations` | Yes | List conversation threads |
| GET | `/api/messages/direct/:peerId` | Yes | List messages with a specific player |
| POST | `/api/messages/direct` | Yes | Send a direct message |
| DELETE | `/api/messages/direct/:id` | Yes | Delete a message (soft-delete per side) |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/api/users/me/description` | Yes | Update own profile description |
| POST | `/api/users/me/avatar` | Yes | Upload player avatar |
| GET | `/api/users/:id/profile` | Yes | Get player profile (cities, stats, alliance) |

### Config

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/config` | No | Returns shared game config (buildings, units, speed, travel constants) |

## Database Schema

15 models across 6 enums. Key entities:

- **User** — player account, governor progress, lifetime combat stats, alliance membership
- **City** — coordinates, loyalty, resources (lazily synced), owner (nullable for ghost cities)
- **Building** — 9 types per city, level 0–30
- **Unit** — 11 types per city, quantity tracked
- **Command** — attack/support/resources/spy with travel state machine (TRAVELING → ARRIVED/RETURNING → COMPLETED)
- **CommandUnit** — units attached to a command
- **BuildingUpgradeOrder** / **RecruitmentOrder** — queued orders with BullMQ job references
- **Alliance** — name, tag, access mode (OPEN/CLOSED/INVITE_ONLY/APPLICATION), leader
- **AllianceInvitation** / **AllianceApplication** — join request management
- **AllianceMessage** — alliance chat (soft-deletable)
- **DirectMessage** — player-to-player messages (read tracking, soft-delete per side)
- **SharedReport** — shared battle/spy reports with visibility toggles

## Game Mechanics

### Buildings

9 building types, upgradeable to level 20–30. Each level increases cost and construction time exponentially. Headquarters level reduces construction time by 2% per level.

| Building | Function | Max Level | HQ Required |
|----------|----------|-----------|-------------|
| Headquarters | Reduces construction time 2%/level | 30 | — |
| Bank | Produces Money | 30 | — |
| Power plant | Produces Energy | 30 | — |
| Weapons factory | Produces Ammo | 30 | — |
| Housing | Population limit (240–24,000) | 30 | — |
| Warehouse | Resource storage limit (1,000–400,000) | 30 | — |
| Military base | Unlocks units, speeds up recruitment | 25 | HQ 5 |
| Harbor | Send resources to other cities | 25 | HQ 15 |
| Air defense | Passive city defense bonus | 20 | HQ 5 |

### Resources

- **Money** — produced by Bank
- **Energy** — produced by Power plant
- **Ammo** — produced by Weapons factory

Production rates increase per building level. Resources are synced lazily before any operation that reads or modifies them (no background worker needed).

### Units

11 unit types across 6 categories. Most are recruited from Military base; Governor is recruited via a special account-wide deposit mechanic, and Hacker is recruited from Headquarters.

| Unit | Category | Attack | Defense (I/R/M) | Speed | Pop | HQ | MB |
|------|----------|--------|-----------------|-------|-----|----|----|
| Light infantry | Infantry | 10 | 15/25/10 | 8 | 1 | — | — |
| Defender infantry | Infantry | 5 | 30/30/30 | 12 | 1 | 5 | — |
| Heavy infantry | Infantry | 40 | 20/10/20 | 12 | 2 | — | — |
| Sniper | Range | 60 | 10/30/10 | 10 | 3 | 10 | 10 |
| Special forces | Range | 80 | 40/40/40 | 6 | 4 | 15 | 10 |
| Raider | Mechanized | 30 | 10/10/20 | 4 | 3 | 10 | — |
| Tank | Mechanized | 100 | 50/20/50 | 14 | 6 | 20 | 15 |
| Missile launcher | Siege | 40 | 5/5/5 | 16 | 5 | 20 | 15 |
| Drone | Siege | 50 | 5/5/5 | 18 | 6 | 20 | 20 |
| Governor | Conquer | 0 | 10/10/10 | 16 | 0 | 30 | — |
| Hacker | Spy | 0 | 0/0/0 | 6 | 1 | 10 | — |

*Speed = minutes per map field. Lower = faster. I/R/M = defense vs Infantry/Range/Mechanized.*

### Commands

Players send four types of commands between cities:

| Type | Description |
|------|-------------|
| Attack | Send units to attack another city. Surviving units return with loot |
| Support | Send units to reinforce a city. They stay and defend until withdrawn |
| Resources | Send resources via Harbor merchants |
| Spy | Send hackers to gather intel on a target city |

**Travel time** is computed from euclidean distance and the slowest unit in the stack:

```
distance  = sqrt((x2 - x1)^2 + (y2 - y1)^2)
travel_s  = distance * slowestSpeed * 60 / GAME_SPEED
```

Resource transports use a fixed speed of 2 minutes per field. A TRAVELING command can be cancelled within the first 5 minutes — units return home symmetrically.

### Battle Formula

The overall winner is determined by comparing total attack force against the attack-weighted average of defender forces. Air defense level applies a defense bonus (4%–107%) to all defending units. Hackers (SPY category) are excluded from combat entirely — they have a dedicated spy-vs-spy system (see below).

Attacker losses per unit category (Infantry, Range, Mechanized):

```
loss_rate = (defender_force / attacker_force) ^ 1.5    if attacker wins
loss_rate = 1.0                                         if attacker loses
```

**Siege units** act before the main battle, scaled by the battle ratio:
- **Missile launchers** destroy air defense levels, reducing the defense bonus for all defending units. This softens the city for future attacks even if the current one fails.
- **Drones** demolish levels from a target building chosen by the attacker. If no target is selected, drones assist missile launchers in destroying air defense instead.

### Spy Mechanic

Only Hacker units participate. This is a separate system from regular combat — hackers cannot be sent in attack or support commands. Attacker sends N hackers; defender has D hackers (native + stationed support).

- If `N > D`: spy succeeds. Attacker gets a snapshot of the target city (buildings, units, resources). `N - D` hackers return home. Defender hackers are untouched. The defender is not notified.
- If `N <= D`: spy fails. All attacker hackers die, no intel is retrieved. The defender receives a report about the failed spy attempt.

Defending hackers can never be killed in any scenario.

### Loyalty and Conquest

Each city starts at 100 loyalty. Loyalty regenerates at 1 point per hour (scaled by game speed). When an attack clears all defenders and includes at least one surviving Governor, loyalty is reduced by 20–35 per Governor (random). Loyalty persists between attacks.

When loyalty drops to 0: ownership transfers to the attacker, one Governor is consumed, loyalty resets to 100, all native units in the city are reset to 0 (including hackers and governors), and any stationed support from third parties is sent home.

### Battle Simulator

The client includes an offline battle simulator that uses the exact same `calculateBattle()` function as the server. Players can test army compositions, air defense levels, and resource scenarios before committing real units — the results are guaranteed to match actual combat outcomes.

### Ghost Cities

Unowned NPC cities that spawn near each player on registration. They provide early-game attack targets for farming resources. Ghost cities auto-upgrade one random building every 6 hours but they do not recruit units. These cities can also be supplied with resources and supported with units.

### Multiple Cities

A player's account can own any number of cities (starter + conquered). The active city is tracked in `localStorage` and mirrored into URL params. On the map, clicking your own city offers Select (switch active) and Enter (navigate to city dashboard). Non-active owned cities also show Support/Resources buttons.

### Alliances

Players can create or join alliances. Access modes: Open, Closed, Invite only, Application. Features include alliance chat, member management (kick, transfer leadership), and alliance leaderboards.

### Messages

Players can send direct messages to each other. Messages support embedded shared reports (paste `[report:id]` tag). Soft-delete per side — each player can delete their view independently.

### Report Sharing

Battle and spy reports can be shared with visibility options:
- Hide own troops
- Show only own losses (hide initial count)
- Hide enemy troops / intel

Sharing generates a `[report:id]` tag that can be pasted into any message.

## Job Queue (BullMQ)

Three workers process async game events via Redis-backed queues:

| Worker | Queue | Purpose |
|--------|-------|---------|
| `building.worker.ts` | `building-upgrade` | Completes building upgrades after construction time |
| `recruitment.worker.ts` | `unit-recruitment` | Completes unit recruitment after training time |
| `command.worker.ts` | `command-travel` | Processes command arrivals: battle resolution, resource delivery, spy missions, support stationing, return trips |

Additionally, `ghost.service.ts` runs a periodic ticker (not BullMQ) that auto-upgrades ghost city buildings.

## Load Testing

Load tests are written with [Locust](https://locust.io/) (Python). The test file `locustfile.py` simulates concurrent players performing heavy game operations: building upgrades, unit recruitment, attack/spy/resource commands, and direct messages.

### Running

```bash
pip install locust
locust -f locustfile.py --host http://localhost:3000
```

Open `http://localhost:8089` in the browser, set number of users and spawn rate, and start the test.

### Results (500 concurrent users, spawn rate 5, 1–3s think time)

Tested on a low-spec machine (4 cores, 5.7 GB RAM, running server + database + Redis + Locust simultaneously):

| Operation | Requests | Failures | Median | p95 | p99 |
|-----------|----------|----------|--------|-----|-----|
| Register | 500 | 2 | 140ms | 300ms | 470ms |
| Building upgrade | 7,725 | 1 | 38ms | 1,200ms | 2,000ms |
| Unit recruitment | 7,947 | 0 | 16ms | 500ms | 970ms |
| Attack command | 4,918 | 0 | 29ms | 780ms | 1,500ms |
| Spy command | 2,461 | 0 | 18ms | 580ms | 1,000ms |
| Resource transfer | 2,460 | 0 | 18ms | 540ms | 1,100ms |
| Direct messages | 5,727 | 0 | 22ms | 670ms | 1,300ms |
| City overview | 4,496 | 0 | 34ms | 1,000ms | 1,900ms |
| World map | 2,875 | 0 | 15ms | 670ms | 1,300ms |
| Rankings | 2,003 | 0 | 12ms | 320ms | 500ms |

5 failures out of 54,916 total requests (0.009%). 218 req/s aggregate throughput. All gameplay operations maintain 0% failure rate under heavy load.

### Extended run (600 concurrent users, spawn rate 1, ~12 minutes)

| Operation | Requests | Failures | Median | p95 | p99 |
|-----------|----------|----------|--------|-----|-----|
| Register | 600 | 0 | 110ms | 1,800ms | 2,900ms |
| Building upgrade | 14,559 | 0 | 54ms | 2,500ms | 3,600ms |
| Unit recruitment | 14,516 | 2 | 24ms | 1,200ms | 1,900ms |
| Attack command | 9,698 | 0 | 34ms | 1,500ms | 2,600ms |
| Spy command | 4,935 | 0 | 28ms | 1,100ms | 1,900ms |
| Resource transfer | 4,920 | 0 | 27ms | 1,200ms | 2,000ms |
| Direct messages | 10,908 | 2 | 33ms | 1,700ms | 2,700ms |
| City overview | 8,023 | 0 | 44ms | 2,500ms | 3,500ms |
| World map | 5,505 | 2 | 26ms | 1,100ms | 2,300ms |
| Rankings | 3,621 | 1 | 21ms | 730ms | 1,700ms |

10 failures out of 102,827 total requests (0.0097%). 217 req/s sustained over 12 minutes with 600 concurrent users.

### Performance optimizations

The server was profiled and optimized using Locust. Key bottlenecks identified and resolved:

- **SlotAllocator** (`slotAllocator.ts`) — in-memory singleton with async mutex that replaced per-request `SELECT * FROM city` queries for map slot allocation. Eliminates race conditions where concurrent registrations picked the same coordinates, and removes redundant full-table scans (previously 2 scans per registration).
- **Inline resource sync** — `syncResources` was called before city overview, which then re-fetched the city to get updated values (3 DB queries). Refactored to pass the already-loaded city object and return updated values directly (1 query).
- **In-memory caching** — `GET /map` and `GET /rankings` responses cached with 5–10 second TTL. These endpoints load all cities/users with all buildings and were called hundreds of times per second under load with identical results.
- **Database indexes** — added indexes on `City.ownerId`, `Command(fromCityId, status)`, `Command(toCityId, type, status)`, `BuildingUpgradeOrder.cityId`, `RecruitmentOrder.cityId`. Without these, PostgreSQL was doing full table scans on the most frequent queries.
- **Ghost ticker batching** — ghost city auto-upgrades changed from sequential (one query per city) to parallel batches of 50, reducing connection pool contention.
- **PostgreSQL tuning** — `shared_buffers`, `work_mem`, and `effective_cache_size` configured proportionally to available RAM (previously set too high, causing memory pressure).

## Architecture Decisions

- **Express over NestJS**: Manual layering (Controller → Service → Prisma) is simpler for a project with ~50 endpoints. NestJS decorators add ceremony without benefit at this scale.
- **Lazy resource sync**: Resources are computed on-read from production rate and elapsed time, rather than ticked by a background worker. This eliminates an entire worker and keeps resource values consistent without race conditions.
- **Shared game config**: `shared/gameConfig.ts` is the single source of truth for all game balance data (costs, speeds, formulas). Both client and server import it directly, so they never drift.
- **Optimistic locking**: Resource deductions use Prisma transactions with conditional updates to prevent double-spending under concurrent requests.
- **Mutex-based slot allocation**: City placement uses an in-memory `SlotAllocator` singleton with an async mutex. All slot reservations are serialized, eliminating coordinate collisions entirely. The occupied set is loaded once from DB at startup and updated in-memory on each allocation — zero DB queries for slot-finding.
- **Shared battle calculator**: `battleCalc.ts` is imported by both the server (for real combat) and the client (for the battle simulator). One formula, zero drift.
- **Soft-delete reports**: Each side of a battle can independently hide their report without affecting the other player's view.
