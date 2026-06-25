-- Data migration: fix_inflation_rate_units
-- Problema: InflationRate.monthlyVariation estaba guardado en FRACCIÓN (ej. 0.0158 para 1.58%).
-- La unidad canónica del sistema es PUNTOS PORCENTUALES (ej. 1.58 para 1.58%).
-- Esta migración convierte todos los registros existentes multiplicando ×100.
-- El seed histórico (20260623000000_seed_historical_ipc) y cualquier dato sincronizado
-- previamente quedan corregidos. Los nuevos datos ingresados por el sync ya llegan
-- en puntos % (la ingesta fue corregida simultáneamente).

UPDATE "InflationRate"
SET "monthlyVariation" = "monthlyVariation" * 100;
