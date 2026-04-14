-- AlterTable
ALTER TABLE "Command" ADD COLUMN "reportHiddenByAttacker" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Command" ADD COLUMN "reportHiddenByDefender" BOOLEAN NOT NULL DEFAULT false;
