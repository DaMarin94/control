-- Fase 1.1.1 — Fijos extendidos: frecuencia (P2) + meses salteados (P1)

-- CreateEnum: frecuencias cerradas para movimientos fijos
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL');

-- AlterTable: agregar columna frequency con default MONTHLY (back-compat con todos los fijos existentes)
ALTER TABLE "Recurring" ADD COLUMN "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY';

-- CreateTable: meses salteados — un registro por aparición anulada de un fijo
-- onDelete: Cascade garantiza que si se borra el fijo, sus skips desaparecen automáticamente
CREATE TABLE "RecurringSkip" (
    "id" TEXT NOT NULL,
    "recurringId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: búsqueda eficiente de skips por fijo
CREATE INDEX "RecurringSkip_recurringId_idx" ON "RecurringSkip"("recurringId");

-- CreateIndex: unicidad (fijo, mes) — no puede haber dos skips para el mismo fijo y mes
CREATE UNIQUE INDEX "RecurringSkip_recurringId_month_key" ON "RecurringSkip"("recurringId", "month");

-- AddForeignKey: vínculo al fijo con cascada de eliminación
ALTER TABLE "RecurringSkip" ADD CONSTRAINT "RecurringSkip_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "Recurring"("id") ON DELETE CASCADE ON UPDATE CASCADE;
