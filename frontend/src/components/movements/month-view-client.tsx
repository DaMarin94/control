"use client";

/**
 * Vista del mes — Client Component (RF-VM-001/002/003/004).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Layout:
 *   - Header: stepper de mes (pill con ‹ / label+sub / ›) + botón "+ Nuevo movimiento"
 *   - Totales: grid 1fr 1fr 1.1fr (Gastos / Ingresos / mini-balance)
 *   - Grupos Únicos / Fijos / Cuotas: .ghead (título uppercase + pill contador + regla + subtotal mono)
 *   - Filas: .mov (grid 40px 1fr auto auto, ícono tintado, nombre+sub, fecha mono, monto mono)
 *
 * Lógica preservada intacta (hooks, router, mappers, handlers).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  getCurrentMonth,
} from "@/lib/format";
import type { MovementItem } from "@/types/movement";
import type { Transaction } from "@/types/transaction";
import type { Recurring } from "@/types/recurring";
import type { InstallmentGroup } from "@/types/installment";

// ─── Mapeo MovementItem → Transaction (únicos) ─────────────────────────────────

function movementItemToTransaction(item: MovementItem): Transaction {
  const occurredAt = item.occurredAt ?? "";
  const timezone = item.timezone ?? "";

  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    occurredAt,
    timezone,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    category: item.category,
  };
}

// ─── Mapeo MovementItem → Recurring (fijos) ────────────────────────────────────

function movementItemToRecurring(item: MovementItem): Recurring {
  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: item.type,
    amountCents: item.amountCents,
    description: item.description,
    startMonth: getCurrentMonth(), // Relleno válido para el schema (no se envía en PATCH)
    deletedFrom: null,
    frequency: item.frequency ?? "MONTHLY",
    createdAt: "",
    updatedAt: "",
    category: item.category,
  };
}

// ─── Mapeo MovementItem → InstallmentGroup (cuotas) ──────────────────────────

function movementItemToInstallment(item: MovementItem): InstallmentGroup {
  return {
    id: item.id,
    userId: "",
    categoryId: item.category.id,
    type: "EXPENSE",
    amountCents: item.amountCents,
    totalInstallments: item.installment?.total ?? 1,
    startMonth: item.installment?.startMonth ?? "",
    description: item.description,
    createdAt: "",
    updatedAt: "",
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
  // Separar "junio 2026" en partes para mostrar
  const labelParts = monthLabel.split(" ");
  const mesName = labelParts[0]
    ? labelParts[0].charAt(0).toUpperCase() + labelParts[0].slice(1)
    : "";
  const yearName = labelParts[1] ?? "";

  const isCurrentMonth = month === getCurrentMonth();

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

  // Subtotales por grupo (en centavos, con signo)
  function groupSubtotal(items: MovementItem[]): number {
    return items.reduce((acc, m) => {
      return acc + (m.type === "EXPENSE" ? -m.amountCents : m.amountCents);
    }, 0);
  }

  function formatSubtotal(cents: number): string {
    const abs = formatCurrency(Math.abs(cents));
    if (cents > 0) return `+${abs}`;
    if (cents < 0) return `−${abs}`;
    return abs;
  }

  const expenseCents = totals?.expenseCents ?? 0;
  const incomeCents = totals?.incomeCents ?? 0;
  const balanceCents = totals?.balanceCents ?? 0;

  return (
    <div className="space-y-0">
      {/* ── Header: stepper + botón ── */}
      <div className="flex items-end justify-between gap-5 mb-6 flex-wrap">
        {/* Stepper de mes (pill) */}
        <div className="inline-flex items-center gap-0.5 bg-panel border border-line rounded-pill px-1 py-1 shadow-[var(--shadow-sm)]">
          <button
            onClick={goToPrevMonth}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[124px] text-center px-1">
            <span className="block text-[14.5px] font-semibold text-ink">
              {mesName} {yearName}
            </span>
            <span className="block text-[11px] font-medium text-muted tracking-[0.02em] -mt-0.5">
              {isCurrentMonth ? "Mes en curso" : "Histórico"}
            </span>
          </div>
          <button
            onClick={goToNextMonth}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <NewTransactionButton label="+ Nuevo movimiento" defaultMonth={month} />
      </div>

      {/* ── Totales / error / loading ── */}
      {isLoading ? (
        <div className="grid gap-[var(--gap)] mb-6" style={{ gridTemplateColumns: "1fr 1fr 1.1fr" }} aria-label="Cargando totales" role="status">
          <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
          <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
          <div className="h-[90px] animate-pulse rounded-card bg-panel-3" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="mb-6 rounded-card border border-expense bg-expense-soft px-4 py-3 text-sm text-expense-ink"
        >
          No se pudo cargar el mes. Intentá recargar la página.
        </div>
      ) : (
        <>
          {/* Tarjetas de totales compactas: grid 1fr 1fr 1.1fr */}
          <div
            className="grid gap-[var(--gap)] mb-6"
            style={{ gridTemplateColumns: "1fr 1fr 1.1fr" }}
          >
            {/* Gastos */}
            <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px]" style={{ padding: "16px 18px" }}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Gastos
              </div>
              <div className="text-[23px] font-semibold tracking-[-0.02em] leading-none mono text-ink">
                {formatCurrency(expenseCents)}
              </div>
            </div>

            {/* Ingresos */}
            <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] flex flex-col gap-[6px]" style={{ padding: "16px 18px" }}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Ingresos
              </div>
              <div className="text-[23px] font-semibold tracking-[-0.02em] leading-none mono text-income-ink">
                {formatCurrency(incomeCents)}
              </div>
            </div>

            {/* Mini-balance */}
            <div
              className="rounded-card relative overflow-hidden text-white shadow-[var(--shadow-md)] flex flex-col gap-[6px]"
              style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, var(--accent-press), var(--accent))",
              }}
            >
              <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/70">
                Balance
              </div>
              <div className="text-[28px] font-semibold tracking-[-0.02em] leading-none mono">
                {balanceCents >= 0
                  ? `+ ${formatCurrency(balanceCents)}`
                  : `− ${formatCurrency(Math.abs(balanceCents))}`}
              </div>
            </div>
          </div>

          {/* ── Lista agrupada por origen ── */}
          <div className="space-y-[30px] mt-1">
            {/* Únicos */}
            {unicos.length > 0 && (
              <section aria-labelledby="section-unicos">
                {/* Cabecera del grupo */}
                <div className="flex items-center gap-3 px-1 pb-[10px]">
                  <span
                    id="section-unicos"
                    className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2"
                  >
                    Únicos
                  </span>
                  <span className="text-[11.5px] font-semibold text-muted bg-panel-3 rounded-pill px-[9px] py-[1px]">
                    {unicos.length}
                  </span>
                  <span className="flex-1 h-px bg-hair" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-muted mono">
                    {formatSubtotal(groupSubtotal(unicos))}
                  </span>
                </div>
                {/* Lista */}
                <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
                  {unicos.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      viewMonth={month}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fijos */}
            {fijos.length > 0 && (
              <section aria-labelledby="section-fijos">
                <div className="flex items-center gap-3 px-1 pb-[10px]">
                  <span
                    id="section-fijos"
                    className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2"
                  >
                    Fijos
                  </span>
                  <span className="text-[11.5px] font-semibold text-muted bg-panel-3 rounded-pill px-[9px] py-[1px]">
                    {fijos.length}
                  </span>
                  <span className="flex-1 h-px bg-hair" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-muted mono">
                    {formatSubtotal(groupSubtotal(fijos))}
                  </span>
                </div>
                <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
                  {fijos.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      viewMonth={month}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cuotas */}
            {cuotas.length > 0 && (
              <section aria-labelledby="section-cuotas">
                <div className="flex items-center gap-3 px-1 pb-[10px]">
                  <span
                    id="section-cuotas"
                    className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2"
                  >
                    Cuotas
                  </span>
                  <span className="text-[11.5px] font-semibold text-muted bg-panel-3 rounded-pill px-[9px] py-[1px]">
                    {cuotas.length}
                  </span>
                  <span className="flex-1 h-px bg-hair" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-muted mono">
                    {formatSubtotal(groupSubtotal(cuotas))}
                  </span>
                </div>
                <div className="bg-panel border border-line rounded-card overflow-hidden shadow-[var(--shadow-sm)]">
                  {cuotas.map((item) => (
                    <MovementItemRow
                      key={item.id}
                      movement={item}
                      viewMonth={month}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Estado vacío (sin movimientos en ninguna sección) */}
            {unicos.length === 0 && fijos.length === 0 && cuotas.length === 0 && (
              <div className="rounded-card border border-dashed border-line bg-panel-2 px-6 py-8 text-center">
                <p className="text-[15px] font-semibold text-ink">
                  No hay movimientos en {mesName.toLowerCase()} {yearName}
                </p>
                <p className="mt-1 text-[13px] text-muted">
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
          viewMonth={month}
        />
      )}

      {/* ── Diálogo eliminar fijo ── */}
      {deletingFijo && (
        <DeleteRecurringDialog
          movement={deletingFijo}
          onClose={() => setDeletingFijo(null)}
          viewMonth={month}
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
