-- AlterTable: add coordinates as nullable, backfill, then enforce NOT NULL + unique

ALTER TABLE "City" ADD COLUMN "x" INTEGER;
ALTER TABLE "City" ADD COLUMN "y" INTEGER;

-- Backfill existing cities with random unique coordinates in 0..99
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY random()) - 1 AS rn
  FROM "City"
),
coords AS (
  SELECT
    n.id,
    -- pick a random offset and spread cities across the 10000-cell grid
    ((n.rn * 4733 + 137) % 10000) AS slot
  FROM numbered n
)
UPDATE "City" c
SET "x" = co.slot % 100,
    "y" = co.slot / 100
FROM coords co
WHERE c.id = co.id;

ALTER TABLE "City" ALTER COLUMN "x" SET NOT NULL;
ALTER TABLE "City" ALTER COLUMN "y" SET NOT NULL;

CREATE UNIQUE INDEX "City_x_y_key" ON "City"("x", "y");
