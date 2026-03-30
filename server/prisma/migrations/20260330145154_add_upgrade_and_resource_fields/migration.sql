-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "upgradeFinishesAt" TIMESTAMP(3),
ADD COLUMN     "upgradeJobId" TEXT;

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "lastResourceUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
