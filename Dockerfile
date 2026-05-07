# Two independently buildable final targets:
#
#   server    — Express API only; use when the client is on Vercel or another CDN
#   fullstack — server + client dist bundled in (default; used by docker-compose)
#
# Examples:
#   docker build --target server -t asow-server .
#   docker build                 -t asow .          # builds fullstack

# ─── Stage 1: Build client ────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY client/package.json client/package-lock.json ./client/
COPY shared/ ./shared/

WORKDIR /app/client
RUN npm ci

# Copy the rest of the client source
COPY client/ ./

# vite.config.ts resolves @shared → ../shared (= /app/shared) ✓
RUN npm run build
# Output: /app/client/dist/

# ─── Stage 2: Build server ────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
COPY shared/ ./shared/

WORKDIR /app/server
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src/ ./src/
COPY server/scripts/ ./scripts/
COPY server/prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build
# tsconfig: rootDir=".." outDir="./dist"
# Output: /app/server/dist/server/src/app.js, /app/server/dist/shared/…

# ─── Target: server ───────────────────────────────────────────────────────────
# Express API only — no client dist bundled in. Use when the client is deployed
# separately (Vercel, CDN, etc.).
FROM node:20-alpine AS server

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=server-builder /app/server/dist/       ./dist/
COPY --from=server-builder /app/server/node_modules/ ./node_modules/
COPY --from=server-builder /app/server/prisma/     ./prisma/
COPY --from=server-builder /app/server/package.json ./
COPY --from=server-builder /app/server/scripts/    ./scripts/
COPY --from=server-builder /app/shared/            /shared/
COPY --from=server-builder /app/server/tsconfig.json ./

COPY docker-entrypoint.sh ./
# Strip Windows carriage returns (\r) in case the file was checked out with CRLF
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]

# ─── Target: fullstack (default) ──────────────────────────────────────────────
# Extends `server` — the Express app also serves the Vite SPA as static files.
# One container, one port. This is what docker-compose.yml builds by default.
FROM server AS fullstack

# Place the client build where the server's static middleware expects it.
# At runtime: __dirname = /app/dist/server/src
#   path.join(__dirname, "../../client/dist") = /app/dist/client/dist  ✓
COPY --from=client-builder /app/client/dist/ ./dist/client/dist/
