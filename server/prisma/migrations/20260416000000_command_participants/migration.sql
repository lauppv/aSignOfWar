-- Add participant columns to Command (nullable to allow backfill).
ALTER TABLE "Command"
  ADD COLUMN "attackerUserId" TEXT,
  ADD COLUMN "defenderUserId" TEXT;

-- Backfill: use the current city ownership as a best-effort snapshot of
-- the participants at the time the report was created. For rows where the
-- involved cities have since changed hands this is only approximate, but
-- from here on new rows will be set explicitly from the correct user ids.
UPDATE "Command" c
SET
  "attackerUserId" = fc."ownerId",
  "defenderUserId" = tc."ownerId"
FROM "City" fc, "City" tc
WHERE c."fromCityId" = fc."id"
  AND c."toCityId"   = tc."id";

-- attackerUserId is always present for new rows (fromCity must be owned),
-- so enforce NOT NULL after the backfill. Rows whose fromCity is unowned
-- (ghost) are edge cases and shouldn't exist historically, but we fall back
-- to an arbitrary existing user if any such row is found so the migration
-- doesn't break.
UPDATE "Command"
SET "attackerUserId" = (SELECT "id" FROM "User" LIMIT 1)
WHERE "attackerUserId" IS NULL;

ALTER TABLE "Command"
  ALTER COLUMN "attackerUserId" SET NOT NULL;

ALTER TABLE "Command"
  ADD CONSTRAINT "Command_attackerUserId_fkey"
    FOREIGN KEY ("attackerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Command_defenderUserId_fkey"
    FOREIGN KEY ("defenderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Command_attackerUserId_idx" ON "Command"("attackerUserId");
CREATE INDEX "Command_defenderUserId_idx" ON "Command"("defenderUserId");
