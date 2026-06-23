-- Migration: add_rate_sync_tables (P7 — sincronización de cotizaciones externas)
-- Agrega tres tablas globales (sin userId) para la ingesta de FX e IPC externos:
--   CurrencyQuote  : histórico de variantes de cotización FX por (moneda, variante, mes)
--   InflationRate  : IPC argentino por mes (variación mensual + nivel del índice)
--   RateSyncLog    : auditoría de cada intento de escritura del sync

-- CurrencyQuote — variantes de cotización FX
-- Una fila por (currency, variant, yearMonth). variant es string libre (NO enum):
-- la allowlist de variantes conocidas vive en el código del sync, no en la DB.
-- compra/venta en unidades de la moneda por 1 USD (mismo pivote que ReferenceRate).
CREATE TABLE "CurrencyQuote" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "currency"   "Currency" NOT NULL,
  "variant"    TEXT NOT NULL,
  "yearMonth"  TEXT NOT NULL,
  "compra"     DECIMAL(18,6) NOT NULL,
  "venta"      DECIMAL(18,6) NOT NULL,
  "source"     TEXT NOT NULL,
  "fetchedAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CurrencyQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurrencyQuote_currency_variant_yearMonth_key"
    UNIQUE ("currency", "variant", "yearMonth")
);

CREATE INDEX "CurrencyQuote_currency_yearMonth_idx"
  ON "CurrencyQuote" ("currency", "yearMonth");

-- InflationRate — IPC nacional (INDEC) por mes
-- Clave única: yearMonth (un único valor de IPC por mes).
CREATE TABLE "InflationRate" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "yearMonth"        TEXT NOT NULL,
  "monthlyVariation" DECIMAL(18,6) NOT NULL,
  "indexValue"       DECIMAL(18,6) NOT NULL,
  "source"           TEXT NOT NULL,
  "fetchedAt"        TIMESTAMPTZ NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "InflationRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InflationRate_yearMonth_key" UNIQUE ("yearMonth")
);

-- RateSyncLog — auditoría de cada intento de ingesta externa
-- Una fila por intento de escritura (aceptado o rechazado).
-- El secret NUNCA se loguea en ningún campo.
CREATE TABLE "RateSyncLog" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "source"     TEXT NOT NULL,
  "target"     TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "accepted"   BOOLEAN NOT NULL,
  "reason"     TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "RateSyncLog_pkey" PRIMARY KEY ("id")
);
