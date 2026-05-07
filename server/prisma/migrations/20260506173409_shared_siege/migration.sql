-- CreateTable
CREATE TABLE "SharedSiege" (
    "id" TEXT NOT NULL,
    "siegeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedSiege_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedSiege_siegeId_idx" ON "SharedSiege"("siegeId");

-- AddForeignKey
ALTER TABLE "SharedSiege" ADD CONSTRAINT "SharedSiege_siegeId_fkey" FOREIGN KEY ("siegeId") REFERENCES "Siege"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedSiege" ADD CONSTRAINT "SharedSiege_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
