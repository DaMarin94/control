-- Mes de referencia (offset) para la BASE de la fórmula de un calculado de
-- FIJO (sourceChainId != null). 0 = comportamiento actual (base = monto del
-- origen en el mismo mes consultado). Solo tiene sentido > 0 en calculados de
-- fijo; en fijos normales y en calculados de único/cuota queda en 0.
--
-- Escrita a mano (no diff automático): el cambio es un simple ADD COLUMN con
-- default, sin necesidad de shadow database ni backfill (el @default(0) deja
-- las filas existentes idénticas al comportamiento previo).
ALTER TABLE "Recurring" ADD COLUMN "sourceMonthOffset" INTEGER NOT NULL DEFAULT 0;
