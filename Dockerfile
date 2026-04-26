FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
COPY shared/ ./shared/

WORKDIR /app/server
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src/ ./src/
COPY server/prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/server/dist/ ./dist/
COPY --from=builder /app/server/node_modules/ ./node_modules/
COPY --from=builder /app/server/prisma/ ./prisma/
COPY --from=builder /app/server/package.json ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/src/app.js"]
