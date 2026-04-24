-- CreateIndex
CREATE INDEX "BuildingUpgradeOrder_cityId_idx" ON "BuildingUpgradeOrder"("cityId");

-- CreateIndex
CREATE INDEX "City_ownerId_idx" ON "City"("ownerId");

-- CreateIndex
CREATE INDEX "Command_fromCityId_status_idx" ON "Command"("fromCityId", "status");

-- CreateIndex
CREATE INDEX "Command_toCityId_type_status_idx" ON "Command"("toCityId", "type", "status");

-- CreateIndex
CREATE INDEX "Command_attackerUserId_idx" ON "Command"("attackerUserId");

-- CreateIndex
CREATE INDEX "Command_defenderUserId_idx" ON "Command"("defenderUserId");

-- CreateIndex
CREATE INDEX "RecruitmentOrder_cityId_idx" ON "RecruitmentOrder"("cityId");
