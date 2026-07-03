-- P3 (Fase 1.1.1.ext) — Anulación (skip) de movimientos únicos y cuotas.
--
-- Únicos: el skip es un flag booleano en la fila (un único es UNA fila, sin mes).
-- Cuotas: el skip es una tabla InstallmentSkip, espejo exacto de RecurringSkip,
--   que anula UNA instancia (mes) puntual del grupo, no el grupo entero.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "skipped" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstallmentSkip" (
    "id" TEXT NOT NULL,
    "installmentGroupId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallmentSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentSkip_installmentGroupId_idx" ON "InstallmentSkip"("installmentGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentSkip_installmentGroupId_month_key" ON "InstallmentSkip"("installmentGroupId", "month");

-- AddForeignKey
ALTER TABLE "InstallmentSkip" ADD CONSTRAINT "InstallmentSkip_installmentGroupId_fkey" FOREIGN KEY ("installmentGroupId") REFERENCES "InstallmentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
