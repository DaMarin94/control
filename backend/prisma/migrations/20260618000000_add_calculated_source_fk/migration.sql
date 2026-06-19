-- Fase 1.1.7.ext — Calculados de único y cuota: FK sourceMovementId + sourceInstallmentGroupId en Recurring

-- AlterTable: dos FK nullables nuevas
ALTER TABLE "Recurring"
  ADD COLUMN "sourceMovementId" TEXT,
  ADD COLUMN "sourceInstallmentGroupId" TEXT;

-- FK a Transaction (calculado de único). onDelete: Cascade.
ALTER TABLE "Recurring"
  ADD CONSTRAINT "Recurring_sourceMovementId_fkey"
  FOREIGN KEY ("sourceMovementId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK a InstallmentGroup (calculado de cuota). onDelete: Cascade.
ALTER TABLE "Recurring"
  ADD CONSTRAINT "Recurring_sourceInstallmentGroupId_fkey"
  FOREIGN KEY ("sourceInstallmentGroupId") REFERENCES "InstallmentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índices para búsquedas por origen
CREATE INDEX "Recurring_sourceMovementId_idx" ON "Recurring"("sourceMovementId");
CREATE INDEX "Recurring_sourceInstallmentGroupId_idx" ON "Recurring"("sourceInstallmentGroupId");
