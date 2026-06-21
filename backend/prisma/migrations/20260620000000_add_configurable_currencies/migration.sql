-- Migration: add_configurable_currencies (Fase 1.2.4)
-- Suma EUR y BRL al enum Currency.
-- Crea la tabla ReferenceRate (cotizaciones de referencia por mes, global, sin userId).
-- Back-compat: todos los registros existentes quedan como estaban (ARS/USD).
-- USD no se guarda como fila en ReferenceRate (rate_USD = 1 implícito por definición del pivote).

-- 1. Agregar los nuevos valores al enum Currency
-- Postgres permite ALTER TYPE ... ADD VALUE (idempotente: falla si ya existe,
-- usar IF NOT EXISTS para que el script sea re-corrible en entornos donde ya se aplicó).
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'EUR';
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'BRL';

-- 2. Crear la tabla ReferenceRate
-- Una fila por (currency, yearMonth). Global: sin userId.
-- rate = unidades de la moneda por 1 USD (pivote USD).
-- USD no tiene filas (implícito rate=1 por ser el pivote).
CREATE TABLE IF NOT EXISTS "ReferenceRate" (
  "id"        TEXT NOT NULL,
  "currency"  "Currency" NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "rate"      DECIMAL(18,6) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReferenceRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferenceRate_currency_yearMonth_key" UNIQUE ("currency", "yearMonth")
);

-- Índice compuesto para las búsquedas por (currency, yearMonth)
CREATE INDEX IF NOT EXISTS "ReferenceRate_currency_yearMonth_idx" ON "ReferenceRate"("currency", "yearMonth");
