-- CreateEnum
CREATE TYPE "AllianceAccess" AS ENUM ('OPEN', 'CLOSED', 'INVITE_ONLY', 'APPLICATION');

-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "accessMode" "AllianceAccess" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "AllianceInvitation" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllianceApplication" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllianceMessage" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllianceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceInvitation_allianceId_userId_key" ON "AllianceInvitation"("allianceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllianceApplication_allianceId_userId_key" ON "AllianceApplication"("allianceId", "userId");

-- CreateIndex
CREATE INDEX "AllianceMessage_allianceId_createdAt_idx" ON "AllianceMessage"("allianceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AllianceInvitation" ADD CONSTRAINT "AllianceInvitation_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceInvitation" ADD CONSTRAINT "AllianceInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceApplication" ADD CONSTRAINT "AllianceApplication_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceApplication" ADD CONSTRAINT "AllianceApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMessage" ADD CONSTRAINT "AllianceMessage_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllianceMessage" ADD CONSTRAINT "AllianceMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
