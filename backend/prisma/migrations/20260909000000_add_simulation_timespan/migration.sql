-- Backfill manual (no diff automático): agrega el tramo propio de cada
-- simulación (startMonth/endMonth, "YYYY-MM") derivándolo de sus filas
-- existentes en vez de un default fijo.
--
-- startMonth = mes de createdAt (semántica exacta: "mes desde el que se creó").
-- endMonth   = diciembre del año de startMonth, extendido a startMonth + 6
--              meses si ese tramo queda por debajo de 6 meses — misma fórmula
--              que `computeHorizonEndMonth` (simulation-window.helper.ts).

-- AlterTable: columnas nullable primero, se completan y recién después se
-- fuerza NOT NULL (la tabla puede tener filas existentes).
ALTER TABLE "Simulation" ADD COLUMN "startMonth" TEXT;
ALTER TABLE "Simulation" ADD COLUMN "endMonth" TEXT;

-- Backfill startMonth desde createdAt.
UPDATE "Simulation"
SET "startMonth" = to_char("createdAt", 'YYYY-MM')
WHERE "startMonth" IS NULL;

-- Backfill endMonth a partir del startMonth recién poblado.
UPDATE "Simulation"
SET "endMonth" = to_char(
  CASE
    WHEN (12 - EXTRACT(MONTH FROM (("startMonth" || '-01')::date))::int) < 6
      THEN (("startMonth" || '-01')::date) + INTERVAL '6 months'
    ELSE make_date(EXTRACT(YEAR FROM (("startMonth" || '-01')::date))::int, 12, 1)
  END,
  'YYYY-MM'
)
WHERE "endMonth" IS NULL;

-- Ahora que no queda ninguna fila sin tramo, se fuerza NOT NULL.
ALTER TABLE "Simulation" ALTER COLUMN "startMonth" SET NOT NULL;
ALTER TABLE "Simulation" ALTER COLUMN "endMonth" SET NOT NULL;
