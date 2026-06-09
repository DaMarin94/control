"use client";

/**
 * Dashboard client — maneja los totales del mes actual (RF-DASH-002).
 *
 * Consulta GET /movements?month=<mesActual> para obtener totals.
 * No lista movimientos individuales (decisión 2026-06-03).
 *
 * Estados:
 * - Cargando: skeleton
 * - Con datos: resumen financiero
 * - Vacío (sin movimientos): totales en cero + CTA "Cargá tu primer movimiento"
 * - Error: mensaje sin romper la pantalla
 */

import { useState } from "react";
import Link from "next/link";
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
  const hasMovements =
    (data?.movements.unicos.length ?? 0) > 0 ||
    (data?.movements.fijos.length ?? 0) > 0 ||
    (data?.movements.cuotas.length ?? 0) > 0;

  const monthLabel = formatMonthLabel(month);

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mes actual</p>
          <h2 className="text-2xl font-bold capitalize">{monthLabel}</h2>
        </div>
        <NewTransactionButton />
      </div>

      {/* ── Resumen financiero ── */}
      {isLoading ? (
        <div className="space-y-3" aria-label="Cargando totales">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          No se pudieron cargar los totales del mes. Intentá recargar la página.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Gastos */}
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gastos
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(totals?.expenseCents ?? 0)}
              </p>
            </div>

            {/* Ingresos */}
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ingresos
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(totals?.incomeCents ?? 0)}
              </p>
            </div>

            {/* Balance */}
            <div className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Balance
              </p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  (totals?.balanceCents ?? 0) >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(totals?.balanceCents ?? 0)}
              </p>
            </div>
          </div>

          {/* Estado vacío */}
          {!hasMovements && (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Todavía no hay movimientos este mes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registrá tu primer gasto o ingreso de {monthLabel}.
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Cargá tu primer movimiento
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Enlace "Ver todos" ── */}
      <div className="flex justify-end">
        <Link
          href={`/mes?month=${month}`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver todos →
        </Link>
      </div>

      {/* ── Modal CTA estado vacío ── */}
      {isNewModalOpen && (
        <TransactionModal
          transaction={null}
          onClose={() => setIsNewModalOpen(false)}
        />
      )}
    </div>
  );
}
