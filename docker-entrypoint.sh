#!/bin/sh
set -e

# Build DATABASE_URL from individual components.
# sslmode=require is added only in production so the same image works
# both with managed cloud databases (production) and a local Docker
# postgres container (development / docker-compose).
if [ "${NODE_ENV}" = "production" ]; then
  SSL_PARAM="&sslmode=require"
else
  SSL_PARAM=""
fi

export DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}?connection_limit=${DATABASE_CONNECTION_LIMIT:-10}${SSL_PARAM}"

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node dist/server/src/app.js
