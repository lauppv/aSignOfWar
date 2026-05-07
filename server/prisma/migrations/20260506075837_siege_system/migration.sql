/*
  Warnings:

  - You are about to drop the column `loyalty` on the `City` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SiegeStatus" AS ENUM ('ACTIVE', 'BROKEN_BY_DEFENSE', 'BROKEN_BY_NEW_SIEGE', 'COMPLETED_CONQUEST');

-- DropIndex
DROP INDEX "Command_attackerUserId_reportHiddenByAttacker_type_idx";

-- DropIndex
DROP INDEX "Command_defenderUserId_reportHiddenByDefender_type_idx";

-- DropIndex
DROP INDEX "Command_status_idx";

-- AlterTable
ALTER TABLE "City" DROP COLUMN "loyalty";

-- CreateTable
CREATE TABLE "Siege" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "attackerUserId" TEXT NOT NULL,
    "garrisonCommandId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SiegeStatus" NOT NULL DEFAULT 'ACTIVE',
    "jobId" TEXT,

    CONSTRAINT "Siege_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Siege_garrisonCommandId_key" ON "Siege"("garrisonCommandId");

-- CreateIndex
CREATE INDEX "Siege_cityId_status_idx" ON "Siege"("cityId", "status");

-- CreateIndex
CREATE INDEX "Siege_attackerUserId_status_idx" ON "Siege"("attackerUserId", "status");

-- CreateIndex
CREATE INDEX "Command_attackerUserId_idx" ON "Command"("attackerUserId");

-- CreateIndex
CREATE INDEX "Command_defenderUserId_idx" ON "Command"("defenderUserId");

-- AddForeignKey
ALTER TABLE "Siege" ADD CONSTRAINT "Siege_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siege" ADD CONSTRAINT "Siege_attackerUserId_fkey" FOREIGN KEY ("attackerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siege" ADD CONSTRAINT "Siege_garrisonCommandId_fkey" FOREIGN KEY ("garrisonCommandId") REFERENCES "Command"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
