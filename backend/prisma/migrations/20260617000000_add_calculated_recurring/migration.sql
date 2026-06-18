-- Fase 1.1.7 — Movimientos calculados: chainId + FormulaOperator + campos del calculado

-- CreateEnum: operadores de la fórmula del movimiento calculado
CREATE TYPE "FormulaOperator" AS ENUM ('ADD', 'SUB', 'MUL', 'DIV', 'PCT');

-- AlterTable: campos nuevos en Recurring
--   chainId:         identidad estable de cadena. DEFAULT gen_random_uuid() para filas
--                    existentes (cada fila preexistente obtiene su propio chainId único).
--                    NOT NULL porque todo fijo tiene cadena.
--   formulaOperator: operador de la fórmula (solo en calculados).
--   formulaOperand:  operando de la fórmula (solo en calculados).
--   formulaSign:     signo del resultado, 1 o -1 (solo en calculados).
--   sourceChainId:   chainId del fijo de origen (solo en calculados, null en normales).
ALTER TABLE "Recurring"
  ADD COLUMN "chainId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "formulaOperand" INTEGER,
  ADD COLUMN "formulaOperator" "FormulaOperator",
  ADD COLUMN "formulaSign" INTEGER,
  ADD COLUMN "sourceChainId" TEXT;

-- Quitar el DEFAULT tras la migración: Prisma gestiona el default desde la app (cuid()).
-- Los registros existentes ya tienen chainId asignado por el DEFAULT de arriba.
ALTER TABLE "Recurring" ALTER COLUMN "chainId" DROP DEFAULT;

-- CreateIndex: búsqueda de fijos por chainId (para localizar la cadena origen)
CREATE INDEX "Recurring_chainId_idx" ON "Recurring"("chainId");

-- CreateIndex: búsqueda de calculados por origen
CREATE INDEX "Recurring_sourceChainId_idx" ON "Recurring"("sourceChainId");
