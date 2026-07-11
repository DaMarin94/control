-- P1 (roadmap): Recurring.frequency pasa de enum (RecurringFrequency) a Int (1..12).
-- Back-compat: MONTHLY→1, BIMONTHLY→2, QUARTERLY→3, BIANNUAL→6, ANNUAL→12.

-- 1. Columna temporal entera
ALTER TABLE "Recurring" ADD COLUMN "frequency_new" INTEGER;

-- 2. Poblar a partir del valor enum existente
UPDATE "Recurring" SET "frequency_new" = CASE "frequency"
  WHEN 'MONTHLY' THEN 1
  WHEN 'BIMONTHLY' THEN 2
  WHEN 'QUARTERLY' THEN 3
  WHEN 'BIANNUAL' THEN 6
  WHEN 'ANNUAL' THEN 12
END;

-- 3. Eliminar la columna enum vieja
ALTER TABLE "Recurring" DROP COLUMN "frequency";

-- 4. Renombrar la columna nueva y fijar NOT NULL / default
ALTER TABLE "Recurring" RENAME COLUMN "frequency_new" TO "frequency";
ALTER TABLE "Recurring" ALTER COLUMN "frequency" SET NOT NULL;
ALTER TABLE "Recurring" ALTER COLUMN "frequency" SET DEFAULT 1;

-- 5. Eliminar el enum, ya no se usa
DROP TYPE "RecurringFrequency";
