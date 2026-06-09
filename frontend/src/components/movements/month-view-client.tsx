"use client";

/**
 * Vista del mes — Client Component (RF-VM-001/002/003/004).
 *
 * Lee el mes desde props (derivado del query param ?month=YYYY-MM en la page).
 * Muestra totales y lista agrupada por origen: Únicos, Fijos, Cuotas.
 * Hoy solo "Únicos" tiene datos; Fijos y Cuotas se muestran solo si tienen ítems.
 *
 * Cableable con TransactionModal (editar) y DeleteTransactionDialog (eliminar).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMovements } from "@/hooks/use-movements";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { DeleteTransactionDialog } from "@/components/movements/delete-transaction-dialog";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import {
  formatCurrency,
  formatMonthLabel,
  prevMonth,
  nextMonth,
} from "@/lib/format";
import type { MovementItem } from "@/types/movement";
import type { Transaction } from "@/types/transaction";

// ─── Mapeo MovementItem → Transaction ──────────────────────────────────────────
//
// TransactionModal y DeleteTransactionDialog esperan Transaction.
// MovementItem tiene los mismos campos core; los campos de audit (userId,
// createdAt, updatedAt) no vienen en la respuesta de /movements pero no son
// necesarios para editar/eliminar — se rellenan con strings vacíos como placeholders.
// categoryId se deriva de category.id que sí viene en MovementItem.

function movementItemToTransaction(item: MovementItem): Transaction {
  return {
    id: item.id,
    userId: "", // no viene en /movements; no lo usa el form de edición
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    occurredAt: item.occurredAt,
    timezone: item.timezone,
    createdAt: item.occurredAt, // placeholder; no lo usa el form
    updatedAt: item.occurredAt, // placeholder; no lo usa el form
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

  // Estado de modales
  const [editingMovement, setEditingMovement] = useState<MovementItem | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<MovementItem | null>(null);

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
                      onEdit={(m) => setEditingMovement(m)}
                      onDelete={(m) => setDeletingMovement(m)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fijos (solo si tienen datos — Fase 6) */}
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
                      onEdit={(m) => setEditingMovement(m)}
                      onDelete={(m) => setDeletingMovement(m)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cuotas (solo si tienen datos — Fase 7) */}
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
                      onEdit={(m) => setEditingMovement(m)}
                      onDelete={(m) => setDeletingMovement(m)}
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

      {/* ── Modal editar ── */}
      {editingMovement && (
        <TransactionModal
          transaction={movementItemToTransaction(editingMovement)}
          onClose={() => setEditingMovement(null)}
        />
      )}

      {/* ── Diálogo eliminar ── */}
      {deletingMovement && (
        <DeleteTransactionDialog
          transaction={movementItemToTransaction(deletingMovement)}
          onClose={() => setDeletingMovement(null)}
        />
      )}
    </div>
  );
}
