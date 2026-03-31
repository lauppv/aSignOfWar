/*
  Warnings:

  - You are about to drop the column `upgradeFinishesAt` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `upgradeJobId` on the `Building` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Building" DROP COLUMN "upgradeFinishesAt",
DROP COLUMN "upgradeJobId";

-- CreateTable
CREATE TABLE "BuildingUpgradeOrder" (
    "id" TEXT NOT NULL,
    "buildingName" "BuildingName" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "finishAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "BuildingUpgradeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentOrder" (
    "id" TEXT NOT NULL,
    "unitName" "UnitName" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "finishAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "RecruitmentOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BuildingUpgradeOrder" ADD CONSTRAINT "BuildingUpgradeOrder_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOrder" ADD CONSTRAINT "RecruitmentOrder_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
