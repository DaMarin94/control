"use client";

/**
 * Vista del mes — Client Component (RF-VM-001/002/003/004).
 *
 * Lee el mes desde props (derivado del query param ?month=YYYY-MM en la page).
 * Muestra totales y lista agrupada por origen: Únicos, Fijos, Cuotas.
 *
 * Cambios en Fase 7:
 * - La sección Cuotas ahora llega poblada desde el backend.
 * - Editar y eliminar ramifican por origin:
 *   - "unico"  → TransactionModal (mode="edit-single") / DeleteTransactionDialog
 *   - "fijo"   → TransactionModal (mode="edit-fixed") / DeleteRecurringDialog
 *   - "cuota"  → TransactionModal (mode="edit-installment") / DeleteInstallmentDialog
 * - movementItemToInstallment convierte un MovementItem de cuota al shape InstallmentGroup
 *   que espera InstallmentForm en modo edición (prefill de todos los campos editables).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMovements } from "@/hooks/use-movements";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { DeleteTransactionDialog } from "@/components/movements/delete-transaction-dialog";
import { DeleteRecurringDialog } from "@/components/movements/delete-recurring-dialog";
import { DeleteInstallmentDialog } from "@/components/movements/delete-installment-dialog";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import {
  formatCurrency,
  formatMonthLabel,
  prevMonth,
  nextMonth,
} from "@/lib/format";
import type { MovementItem } from "@/types/movement";
import type { Transaction } from "@/types/transaction";
import type { Recurring } from "@/types/recurring";
import type { InstallmentGroup } from "@/types/installment";

// ─── Mapeo MovementItem → Transaction (únicos) ─────────────────────────────────
//
// Solo para movimientos únicos — que sí tienen occurredAt y timezone no-null.
// Los campos de audit (userId, createdAt, updatedAt) no vienen en /movements
// pero los modales de edición no los usan — se rellenan con strings vacíos.

function movementItemToTransaction(item: MovementItem): Transaction {
  // Safeguard: solo llamar con un único que tenga occurredAt y timezone
  const occurredAt = item.occurredAt ?? "";
  const timezone = item.timezone ?? "";

  return {
    id: item.id,
    userId: "", // no viene en /movements; el form de edición no lo usa
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    occurredAt,
    timezone,
    createdAt: occurredAt, // placeholder; no lo usa el form
    updatedAt: occurredAt, // placeholder; no lo usa el form
    category: item.category,
  };
}

// ─── Mapeo MovementItem → Recurring (fijos) ────────────────────────────────────
//
// El RecurringForm en modo edición solo necesita: id, type, amountCents,
// categoryId, description, category. Los campos de auditoría no son usados.
// startMonth y deletedFrom no son editables ni se muestran en el form.

function movementItemToRecurring(item: MovementItem): Recurring {
  return {
    id: item.id,
    userId: "", // placeholder; no lo usa RecurringForm
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    startMonth: "", // placeholder; no lo usa RecurringForm en edición
    deletedFrom: null,
    createdAt: "", // placeholder
    updatedAt: "", // placeholder
    category: item.category,
  };
}

// ─── Mapeo MovementItem → InstallmentGroup (cuotas) ──────────────────────────
//
// El InstallmentForm en modo edición necesita: id, type, amountCents,
// totalInstallments, startMonth, categoryId, description, category.
//
// - amountCents, categoryId, description, type → del MovementItem directamente.
// - totalInstallments → de item.installment.total (cuántas cuotas tiene el grupo).
// - startMonth        → de item.installment.startMonth (mes de inicio del grupo).
//
// Los campos de auditoría (userId, createdAt, updatedAt) no los usa el form.
// Safeguard: solo llamar con origin==="cuota" que tenga installment no-null.

function movementItemToInstallment(item: MovementItem): InstallmentGroup {
  return {
    id: item.id,
    userId: "", // placeholder; no lo usa InstallmentForm
    categoryId: item.category.id,
    type: "EXPENSE", // cuotas son siempre EXPENSE en v1
    amountCents: item.amountCents,
    totalInstallments: item.installment?.total ?? 1, // total del grupo
    startMonth: item.installment?.startMonth ?? "", // mes de inicio del grupo
    description: item.description,
    createdAt: "", // placeholder
    updatedAt: "", // placeholder
    category: item.category,
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MonthViewClientProps {
  month: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MonthViewClient({ month }: MonthViewClientProps) {
  const router = useRouter();
  const { data, isLoading, isError } = useMovements(month);

  // Estado de modales para únicos
  const [editingUnico, setEditingUnico] = useState<MovementItem | null>(null);
  const [deletingUnico, setDeletingUnico] = useState<MovementItem | null>(null);

  // Estado de modales para fijos
  const [editingFijo, setEditingFijo] = useState<MovementItem | null>(null);
  const [deletingFijo, setDeletingFijo] = useState<MovementItem | null>(null);

  // Estado de modales para cuotas
  const [editingCuota, setEditingCuota] = useState<MovementItem | null>(null);
  const [deletingCuota, setDeletingCuota] = useState<MovementItem | null>(null);

  const totals = data?.totals;
  const unicos = data?.movements.unicos ?? [];
  const fijos = data?.movements.fijos ?? [];
  const cuotas = data?.movements.cuotas ?? [];

  const monthLabel = formatMonthLabel(month);

  function goToPrevMonth() {
    router.push(`/mes?month=${prevMonth(month)}`);
  }

  function goToNextMonth() {
    router.push(`/mes?month=${nextMonth(month)}`);
  }

  function handleEdit(movement: MovementItem) {
    if (movement.origin === "fijo") {
      setEditingFijo(movement);
    } else if (movement.origin === "cuota") {
      setEditingCuota(movement);
    } else {
      setEditingUnico(movement);
    }
  }

  function handleDelete(movement: MovementItem) {
    if (movement.origin === "fijo") {
      setDeletingFijo(movement);
    } else if (movement.origin === "cuota") {
      setDeletingCuota(movement);
    } else {
      setDeletingUnico(movement);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Encabezado con navegación prev/next ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          aria-label="Mes anterior"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          ‹
        </button>
        <h2 className="text-xl font-bold capitalize">{monthLabel}</h2>
        <button
          onClick={goToNextMonth}
          aria-label="Mes siguiente"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          ›
        </button>
      </div>

      {/* ── Botón nuevo movimiento ── */}
      <div className="flex justify-end">
        <NewTransactionButton />
      </div>

      {/* ── Totales ── */}
      {isLoading ? (
        <div className="space-y-3" aria-label="Cargando totales">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          No se pudo cargar el mes. Intentá recargar la página.
        </div>
      ) : (
        <>
          {/* Tarjetas de totales (RF-VM-002) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gastos
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatCurrency(totals?.expenseCents ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ingresos
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatCurrency(totals?.incomeCents ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Balance
              </p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  (totals?.balanceCents ?? 0) >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(totals?.balanceCents ?? 0)}
              </p>
            </div>
          </div>

          {/* ── Lista agrupada por origen (RF-VM-001) ── */}
          <div className="space-y-6">
            {/* Únicos */}
            {unicos.length > 0 && (
              <section aria-labelledby="section-unicos">
                <h3
                  id="section-unicos"
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Únicos
                </h3>
                <div className="space-y-2">
                  {unicos.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fijos (poblado desde Fase 6) */}
            {fijos.length > 0 && (
              <section aria-labelledby="section-fijos">
                <h3
                  id="section-fijos"
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Fijos
                </h3>
                <div className="space-y-2">
                  {fijos.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cuotas (Fase 7) */}
            {cuotas.length > 0 && (
              <section aria-labelledby="section-cuotas">
                <h3
                  id="section-cuotas"
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Cuotas
                </h3>
                <div className="space-y-2">
                  {cuotas.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Estado vacío (sin movimientos en ninguna sección) */}
            {unicos.length === 0 && fijos.length === 0 && cuotas.length === 0 && (
              <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay movimientos en {monthLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los movimientos que cargues aparecerán aquí.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal editar único ── */}
      {editingUnico && (
        <TransactionModal
          mode="edit-single"
          transaction={movementItemToTransaction(editingUnico)}
          onClose={() => setEditingUnico(null)}
        />
      )}

      {/* ── Diálogo eliminar único ── */}
      {deletingUnico && (
        <DeleteTransactionDialog
          transaction={movementItemToTransaction(deletingUnico)}
          onClose={() => setDeletingUnico(null)}
        />
      )}

      {/* ── Modal editar fijo ── */}
      {editingFijo && (
        <TransactionModal
          mode="edit-fixed"
          recurring={movementItemToRecurring(editingFijo)}
          onClose={() => setEditingFijo(null)}
        />
      )}

      {/* ── Diálogo eliminar fijo ── */}
      {deletingFijo && (
        <DeleteRecurringDialog
          movement={deletingFijo}
          onClose={() => setDeletingFijo(null)}
        />
      )}

      {/* ── Modal editar cuota ── */}
      {editingCuota && (
        <TransactionModal
          mode="edit-installment"
          installment={movementItemToInstallment(editingCuota)}
          onClose={() => setEditingCuota(null)}
        />
      )}

      {/* ── Diálogo eliminar cuota ── */}
      {deletingCuota && (
        <DeleteInstallmentDialog
          movement={deletingCuota}
          onClose={() => setDeletingCuota(null)}
        />
      )}
    </div>
  );
}
