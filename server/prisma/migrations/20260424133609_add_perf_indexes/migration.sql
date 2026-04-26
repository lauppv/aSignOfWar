-- DropIndex
DROP INDEX "Command_attackerUserId_idx";

-- DropIndex
DROP INDEX "Command_defenderUserId_idx";

-- CreateIndex
CREATE INDEX "Command_attackerUserId_reportHiddenByAttacker_type_idx" ON "Command"("attackerUserId", "reportHiddenByAttacker", "type");

-- CreateIndex
CREATE INDEX "Command_defenderUserId_reportHiddenByDefender_type_idx" ON "Command"("defenderUserId", "reportHiddenByDefender", "type");

-- CreateIndex
CREATE INDEX "Command_status_idx" ON "Command"("status");
