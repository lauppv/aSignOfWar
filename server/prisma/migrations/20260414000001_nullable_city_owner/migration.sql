-- Make City.ownerId nullable so ghost cities (barbarian villages) can exist without an owner.

ALTER TABLE "City" DROP CONSTRAINT "City_ownerId_fkey";
ALTER TABLE "City" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "City" ADD CONSTRAINT "City_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
