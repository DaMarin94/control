-- Migration: add_multi_currency (Fase 1.2.3)
-- Agrega moneda y cotización por movimiento, y configuración de moneda del usuario.
-- Back-compat: todos los registros existentes quedan en ARS con exchangeRate = 1.

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- AlterTable User: moneda default y última cotización usada
ALTER TABLE "User" ADD COLUMN "defaultCurrency" "Currency" NOT NULL DEFAULT 'ARS';
ALTER TABLE "User" ADD COLUMN "lastExchangeRate" DECIMAL(18,6);

-- AlterTable Transaction: moneda y cotización por movimiento
ALTER TABLE "Transaction" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'ARS';
ALTER TABLE "Transaction" ADD COLUMN "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable Recurring: moneda y cotización por filo (por mes de aparición via split)
ALTER TABLE "Recurring" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'ARS';
ALTER TABLE "Recurring" ADD COLUMN "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable InstallmentGroup: moneda y cotización única para todo el grupo
ALTER TABLE "InstallmentGroup" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'ARS';
ALTER TABLE "InstallmentGroup" ADD COLUMN "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
