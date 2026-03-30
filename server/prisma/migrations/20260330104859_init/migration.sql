-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('HEADQUARTERS', 'BANK', 'POWER_PLANT', 'WEAPONS_FACTORY', 'MILITARY_BASE', 'HOUSING', 'WAREHOUSE', 'HARBOR', 'AIR_DEFENSE');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('LIGHT_INFANTRY', 'DEFENDER_INFANTRY', 'ANTI_TANK_INFANTRY', 'SNIPER', 'SPECIAL_FORCES', 'RAIDER', 'TANK', 'MISSILE_LAUNCHER', 'DRONE', 'GOVERNOR');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('ATTACK', 'SUPPORT', 'RESOURCES');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('TRAVELING', 'RETURNING', 'ARRIVED', 'COMPLETED');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loyalty" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "money" DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    "energy" DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    "ammo" DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "type" "BuildingType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityUnit" (
    "id" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "CityUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "type" "CommandType" NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'TRAVELING',
    "departureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "resourceMoney" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resourceEnergy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resourceAmmo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fromCityId" TEXT NOT NULL,
    "toCityId" TEXT NOT NULL,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandUnit" (
    "id" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "commandId" TEXT NOT NULL,

    CONSTRAINT "CommandUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_cityId_type_key" ON "Building"("cityId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CityUnit_cityId_unitType_key" ON "CityUnit"("cityId", "unitType");

-- CreateIndex
CREATE UNIQUE INDEX "CommandUnit_commandId_unitType_key" ON "CommandUnit"("commandId", "unitType");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityUnit" ADD CONSTRAINT "CityUnit_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandUnit" ADD CONSTRAINT "CommandUnit_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "Command"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
