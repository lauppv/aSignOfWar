-- Rename ANTI_TANK_INFANTRY -> HEAVY_INFANTRY

CREATE TYPE "UnitName_new" AS ENUM ('LIGHT_INFANTRY', 'DEFENDER_INFANTRY', 'HEAVY_INFANTRY', 'SNIPER', 'SPECIAL_FORCES', 'RAIDER', 'TANK', 'MISSILE_LAUNCHER', 'DRONE', 'GOVERNOR');

ALTER TABLE "Unit" ALTER COLUMN "name" TYPE "UnitName_new"
  USING (CASE WHEN "name"::text = 'ANTI_TANK_INFANTRY' THEN 'HEAVY_INFANTRY'::"UnitName_new" ELSE "name"::text::"UnitName_new" END);

ALTER TABLE "RecruitmentOrder" ALTER COLUMN "unitName" TYPE "UnitName_new"
  USING (CASE WHEN "unitName"::text = 'ANTI_TANK_INFANTRY' THEN 'HEAVY_INFANTRY'::"UnitName_new" ELSE "unitName"::text::"UnitName_new" END);

ALTER TABLE "CommandUnit" ALTER COLUMN "name" TYPE "UnitName_new"
  USING (CASE WHEN "name"::text = 'ANTI_TANK_INFANTRY' THEN 'HEAVY_INFANTRY'::"UnitName_new" ELSE "name"::text::"UnitName_new" END);

ALTER TYPE "UnitName" RENAME TO "UnitName_old";
ALTER TYPE "UnitName_new" RENAME TO "UnitName";
DROP TYPE "UnitName_old";
