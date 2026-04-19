-- CreateTable
CREATE TABLE "SharedReport" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hideOwnTroops" BOOLEAN NOT NULL DEFAULT false,
    "hideOwnInitial" BOOLEAN NOT NULL DEFAULT false,
    "hideEnemyTroops" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedReport_commandId_idx" ON "SharedReport"("commandId");

-- AddForeignKey
ALTER TABLE "SharedReport" ADD CONSTRAINT "SharedReport_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "Command"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedReport" ADD CONSTRAINT "SharedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
