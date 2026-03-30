-- CreateEnum
CREATE TYPE "BuildingName" AS ENUM ('HEADQUARTERS', 'BANK', 'POWER_PLANT', 'WEAPONS_FACTORY', 'MILITARY_BASE', 'HOUSING', 'WAREHOUSE', 'HARBOR', 'AIR_DEFENSE');

-- CreateEnum
CREATE TYPE "UnitName" AS ENUM ('LIGHT_INFANTRY', 'DEFENDER_INFANTRY', 'ANTI_TANK_INFANTRY', 'SNIPER', 'SPECIAL_FORCES', 'RAIDER', 'TANK', 'MISSILE_LAUNCHER', 'DRONE', 'GOVERNOR');

-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('INFANTRY', 'RANGE', 'MECHANIZED', 'SIEGE', 'CONQUER');

-- DropForeignKey
ALTER TABLE "CityUnit" DROP CONSTRAINT "CityUnit_cityId_fkey";

-- DropIndex
DROP INDEX "Building_cityId_type_key";

-- DropIndex
DROP INDEX "CommandUnit_commandId_unitType_key";

-- Rename column type -> name on Building (pastreaza datele existente)
ALTER TABLE "Building" RENAME COLUMN "type" TO "name";
ALTER TABLE "Building" ALTER COLUMN "name" TYPE "BuildingName" USING "name"::text::"BuildingName";

-- Rename column unitType -> name on CommandUnit (pastreaza datele existente)
ALTER TABLE "CommandUnit" RENAME COLUMN "unitType" TO "name";
ALTER TABLE "CommandUnit" ALTER COLUMN "name" TYPE "UnitName" USING "name"::text::"UnitName";

-- DropTable
DROP TABLE "CityUnit";

-- DropEnum
DROP TYPE "BuildingType";

-- DropEnum
DROP TYPE "UnitType";

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" "UnitName" NOT NULL,
    "category" "UnitCategory" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_cityId_name_key" ON "Unit"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_cityId_name_key" ON "Building"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CommandUnit_commandId_name_key" ON "CommandUnit"("commandId", "name");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
