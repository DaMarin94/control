"use client";

/**
 * Dashboard client — maneja los totales del mes actual (RF-DASH-002).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Layout:
 *   - Header .phead: eyebrow + h1 "Mes Año" (año en accent-ink) + botón lg
 *   - Fila de stats grid 1fr 1fr: tarjetas Gastos / Ingresos con .stat + .ki
 *   - Balance hero: gradiente acento, cifra mono 46px, barra de proporción, leyenda
 *   - Footer: contador de movimientos + link "Ver todos →"
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useMovements } from "@/hooks/use-movements";
import { getCurrentMonth, formatMonthLabel, formatCurrency } from "@/lib/format";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { TransactionModal } from "@/components/movements/transaction-modal";

export function DashboardClient() {
  const month = getCurrentMonth();
  const { data, isLoading, isError } = useMovements(month);

  // Estado para el CTA "Cargá tu primer movimiento" del estado vacío
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const totals = data?.totals;
  const unicos = data?.movements.unicos ?? [];
  const fijos = data?.movements.fijos ?? [];
  const cuotas = data?.movements.cuotas ?? [];
  const totalMovements = unicos.length + fijos.length + cuotas.length;
  const hasMovements = totalMovements > 0;

  // Separar mes y año del label para colorear el año en accent-ink
  const monthLabel = formatMonthLabel(month);
  const labelParts = monthLabel.split(" ");
  // "junio 2026" → mes = "junio", año = "2026"
  const mesName = labelParts[0]
    ? labelParts[0].charAt(0).toUpperCase() + labelParts[0].slice(1)
    : "";
  const yearName = labelParts[1] ?? "";

  // Totales en centavos
  const expenseCents = totals?.expenseCents ?? 0;
  const incomeCents = totals?.incomeCents ?? 0;
  const balanceCents = totals?.balanceCents ?? 0;

  // Barra de proporción — ancho relativo a la suma de ingreso + gasto
  const totalAbs = expenseCents + incomeCents;
  const incomeRatio = totalAbs > 0 ? (incomeCents / totalAbs) * 100 : 50;
  const expenseRatio = totalAbs > 0 ? (expenseCents / totalAbs) * 100 : 50;

  // Formatear monto de balance con prefijo de signo
  function formatBalanceAmount(cents: number): string {
    const formatted = formatCurrency(Math.abs(cents));
    if (cents > 0) return `+ ${formatted}`;
    if (cents < 0) return `− ${formatted}`;
    return formatted;
  }

  // Contar gastos e ingresos (únicos + parte proporcional de fijos/cuotas)
  const expenseCount = [...unicos, ...fijos, ...cuotas].filter(
    (m) => m.type === "EXPENSE"
  ).length;
  const incomeCount = [...unicos, ...fijos, ...cuotas].filter(
    (m) => m.type === "INCOME"
  ).length;

  return (
    <div>
      {/* ── Header .phead ── */}
      <div className="flex items-end justify-between gap-5 mb-7 flex-wrap">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted mb-[6px]">
            Tu mes
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            {mesName} <span className="text-accent-ink">{yearName}</span>
          </h1>
        </div>
        <NewTransactionButton label="+ Nuevo movimiento" size="lg" />
      </div>

      {/* ── Resumen financiero ── */}
      {isLoading ? (
        <div className="space-y-[var(--gap)]" aria-label="Cargando totales" role="status">
          <div className="grid grid-cols-2 gap-[var(--gap)]">
            <div className="h-[120px] animate-pulse rounded-card bg-panel-3" />
            <div className="h-[120px] animate-pulse rounded-card bg-panel-3" />
          </div>
          <div className="h-[160px] animate-pulse rounded-card bg-panel-3" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-card border border-expense bg-expense-soft px-4 py-3 text-sm text-expense-ink"
        >
          No se pudieron cargar los totales del mes. Intentá recargar la página.
        </div>
      ) : (
        <div className="space-y-[var(--gap)]">
          {/* Tarjetas de stats: grid 1fr 1fr */}
          <div className="grid grid-cols-2 gap-[var(--gap)]">
            {/* Gastos */}
            <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] flex flex-col gap-[10px] relative overflow-hidden">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-expense-soft text-expense-ink">
                  <ArrowDown size={14} aria-hidden="true" />
                </span>
                Gastos
              </div>
              <div className="text-[30px] font-semibold tracking-[-0.02em] leading-none mono text-ink">
                {formatCurrency(expenseCents)}
              </div>
              <div className="text-[12.5px] text-muted">
                <span className="mono">{expenseCount}</span> movimientos
              </div>
            </div>

            {/* Ingresos */}
            <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] flex flex-col gap-[10px] relative overflow-hidden">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-income-soft text-income-ink">
                  <ArrowUp size={14} aria-hidden="true" />
                </span>
                Ingresos
              </div>
              <div className="text-[30px] font-semibold tracking-[-0.02em] leading-none mono text-income-ink">
                {formatCurrency(incomeCents)}
              </div>
              <div className="text-[12.5px] text-muted">
                <span className="mono">{incomeCount}</span> movimientos
              </div>
            </div>
          </div>

          {/* Balance hero */}
          <div
            className="p-[var(--card-pad)] rounded-card relative overflow-hidden text-white shadow-[var(--shadow-md)]"
            style={{
              background: "linear-gradient(135deg, var(--accent-press), var(--accent))",
            }}
          >
            {/* Círculo decorativo relleno */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full"
              style={{ background: "oklch(1 0 0 / 0.08)" }}
            />
            {/* Círculo decorativo sólo borde */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-[30px] -bottom-[90px] h-[200px] w-[200px] rounded-full"
              style={{ border: "1px solid oklch(1 0 0 / 0.14)" }}
            />

            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/70 relative">
              Balance de {mesName.toLowerCase()}
            </p>
            <div className="text-[46px] font-semibold tracking-[-0.025em] leading-none my-2 mono relative">
              {formatBalanceAmount(balanceCents)}
            </div>

            {/* Barra de proporción */}
            <div
              className="relative flex h-[7px] overflow-hidden rounded-pill mt-[18px]"
              style={{ background: "oklch(1 0 0 / 0.18)" }}
              aria-hidden="true"
            >
              <span
                className="block h-full"
                style={{
                  width: `${incomeRatio}%`,
                  background: "oklch(0.92 0.13 158)",
                }}
              />
              <span
                className="block h-full"
                style={{
                  width: `${expenseRatio}%`,
                  background: "oklch(0.78 0.14 27)",
                }}
              />
            </div>

            {/* Leyenda */}
            <div className="flex justify-between text-[12px] text-white/80 mt-[9px] relative">
              <span>
                Ingresos{" "}
                <b className="text-white font-semibold mono">{formatCurrency(incomeCents)}</b>
              </span>
              <span>
                Gastos{" "}
                <b className="text-white font-semibold mono">{formatCurrency(expenseCents)}</b>
              </span>
            </div>
          </div>

          {/* Estado vacío */}
          {!hasMovements && (
            <div className="rounded-card border border-dashed border-line bg-panel-2 px-6 py-8 text-center">
              <p className="text-[15px] font-semibold text-ink">
                Todavía no hay movimientos este mes
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Registrá tu primer gasto o ingreso de {mesName.toLowerCase()}.
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-ctl bg-accent text-white px-4 py-[10px] text-[14px] font-semibold shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)] hover:bg-accent-press hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <Plus size={16} aria-hidden="true" />
                Cargá tu primer movimiento
              </button>
            </div>
          )}

          {/* Footer de sección */}
          <div className="flex items-center justify-between mt-7 px-0.5">
            <span className="text-[14px] text-muted"></span>
            <Link
              href={`/mes?month=${month}`}
              className="inline-flex items-center gap-[5px] text-[14px] font-semibold text-accent-ink transition-[gap] duration-[140ms] hover:gap-2"
            >
              Ver todos los movimientos →
            </Link>
          </div>
        </div>
      )}

      {/* ── Modal CTA estado vacío ── */}
      {isNewModalOpen && (
        <TransactionModal
          mode="create"
          onClose={() => setIsNewModalOpen(false)}
        />
      )}
    </div>
  );
}
