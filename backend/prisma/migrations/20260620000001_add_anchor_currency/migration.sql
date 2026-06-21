-- Migration: add_anchor_currency (Fase 1.2.4 — fix conversión multi-moneda)
-- Agrega el campo anchorCurrency a Transaction, Recurring e InstallmentGroup.
-- anchorCurrency = moneda default del usuario AL MOMENTO de guardar el movimiento.
-- Determina contra qué moneda está expresado el exchangeRate guardado.
-- Back-compat: todos los registros existentes reciben ARS (era la única opción antes de 1.2.4).

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "anchorCurrency" "Currency" NOT NULL DEFAULT 'ARS';

ALTER TABLE "Recurring"
  ADD COLUMN IF NOT EXISTS "anchorCurrency" "Currency" NOT NULL DEFAULT 'ARS';

ALTER TABLE "InstallmentGroup"
  ADD COLUMN IF NOT EXISTS "anchorCurrency" "Currency" NOT NULL DEFAULT 'ARS';
