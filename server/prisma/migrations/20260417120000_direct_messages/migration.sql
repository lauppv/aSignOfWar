-- AlterTable
ALTER TABLE "AllianceMessage" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readByRecipient" BOOLEAN NOT NULL DEFAULT false,
    "deletedByFrom" BOOLEAN NOT NULL DEFAULT false,
    "deletedByTo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectMessage_fromId_toId_createdAt_idx" ON "DirectMessage"("fromId", "toId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_toId_fromId_createdAt_idx" ON "DirectMessage"("toId", "fromId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_toId_readByRecipient_idx" ON "DirectMessage"("toId", "readByRecipient");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
