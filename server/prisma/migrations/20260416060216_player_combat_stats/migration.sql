-- DropIndex
DROP INDEX "Command_attackerUserId_idx";

-- DropIndex
DROP INDEX "Command_defenderUserId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "killsAsAttacker" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "killsAsDefender" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "killsAsSupporter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lootedAmmo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lootedEnergy" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lootedMoney" DOUBLE PRECISION NOT NULL DEFAULT 0;
