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
import { useHydrated } from "@/hooks/use-hydrated";
import { useApi } from "@/hooks/use-api";
import { useSettings } from "@/hooks/use-settings";
import { useLimits } from "@/hooks/use-limits";
import { evaluateLimits } from "@/lib/limits/evaluate";
import {
  LimitMarkAdorner,
  limitBoldClass,
  limitTintClass,
  limitRingCardClass,
} from "@/components/limits/limit-mark";
import { getCurrentMonth, formatMonthLabel, formatCurrency } from "@/lib/format";
import { NewTransactionButton } from "@/components/movements/new-transaction-button";
import { TransactionModal } from "@/components/movements/transaction-modal";
import { ReportCard } from "@/components/charts/report-card";
import { CurrencyChip } from "@/components/ui/currency-chip";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Deriva el año actual del helper getCurrentMonth para no usar new Date() directamente. */
function getCurrentYear(): number {
  const month = getCurrentMonth(); // "YYYY-MM"
  return parseInt(month.split("-")[0] ?? String(new Date().getFullYear()), 10);
}

export function DashboardClient() {
  const month = getCurrentMonth();
  const currentYear = getCurrentYear();
  const { isAuthenticated } = useApi();
  const { data, isLoading, isError } = useMovements(month);
  // El 1er render del cliente (hidratación) debe coincidir con el SSR, que pinta el
  // skeleton; la caché de React Query puede tener `data` antes de que este boundary hidrate.
  const hydrated = useHydrated();
  const { defaultCurrency } = useSettings();
  // P2 — Fase 1 (Tramo 2): límites del usuario (marca visual pasiva). [] = cero impacto (D9).
  const { limits } = useLimits();

  // Estado para el CTA "Cargá tu primer movimiento" del estado vacío
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Estado efímero del widget de reporte (no se persiste — RF-DASH-001)
  const [reportYear, setReportYear] = useState(currentYear);
  const [reportCategoryIds, setReportCategoryIds] = useState<string[] | null>(null);

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

  // ── P2 — Fase 1 (Tramo 2): marca visual pasiva de límites ────────────────
  // El dashboard reusa mes.total.* / mes.balance (roadmap §2) para el mes en
  // curso — el resumen del dashboard SIEMPRE muestra el mes real de hoy, así
  // que isCurrentMonth es incondicionalmente true (a diferencia de /mes, que
  // navega meses). Con `limits` vacío, evaluateLimits siempre null → cero impacto.
  const expenseLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.total.gasto",
    value: expenseCents / 100,
    isCurrentMonth: true,
  });
  const incomeLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.total.ingreso",
    value: incomeCents / 100,
    isCurrentMonth: true,
  });
  const balanceLimitMark = evaluateLimits({
    limits,
    anchorKey: "mes.balance",
    value: balanceCents / 100,
    isCurrentMonth: true,
  });

  // Formatear monto de balance con prefijo de signo — símbolo de la moneda default
  function formatBalanceAmount(cents: number): string {
    const formatted = formatCurrency(Math.abs(cents), defaultCurrency);
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
          {/* Fila del eyebrow: label + chip de moneda default (a la derecha del eyebrow) */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-muted">
              Tu mes
            </p>
            <CurrencyChip currency={defaultCurrency} />
          </div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            {mesName} <span className="text-accent-ink">{yearName}</span>
          </h1>
        </div>
        <NewTransactionButton label="+ Nuevo movimiento" size="lg" />
      </div>

      {/* ── Resumen financiero ── */}
      {/*
       * Skeleton solo en carga inicial (Ola 1, corrección):
       * - Si ya hay `data` nunca se muestra el skeleton (evita flash en refetch).
       * - Guard !isAuthenticated cubre sesión aún resolviendo (Auth.js status="loading").
       */}
      {(!hydrated || (!data && (!isAuthenticated || isLoading))) ? (
        <div className="space-y-(--gap)" aria-label="Cargando totales" role="status">
          {/* Grid 2 stat-cards: Gastos / Ingresos (~120px cada una) */}
          <div className="grid grid-cols-2 gap-(--gap)">
            <SkeletonBlock height={120} />
            <SkeletonBlock height={120} />
          </div>
          {/* Balance hero (~160px) */}
          <SkeletonBlock height={160} />
          {/* Card de reporte del dashboard (~380px: chrome + canvas 280px + leyenda) */}
          <SkeletonBlock height={380} />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-card border border-expense bg-expense-soft px-4 py-3 text-sm text-expense-ink"
        >
          No se pudieron cargar los totales del mes. Intentá recargar la página.
        </div>
      ) : (
        <div className="space-y-(--gap)">
          {/* Tarjetas de stats: grid 1fr 1fr */}
          <div className="grid grid-cols-2 gap-(--gap)">
            {/* Gastos — mes.total.gasto (P2, Tramo 2: marca visual pasiva) */}
            <div
              className={cn(
                "bg-panel border border-line rounded-card shadow-(--shadow-sm) p-(--card-pad) flex flex-col gap-2.5 relative overflow-hidden",
                limitRingCardClass(expenseLimitMark?.effect),
              )}
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-chip bg-expense-soft text-expense-ink">
                  <ArrowDown size={14} aria-hidden="true" />
                </span>
                Gastos
                <LimitMarkAdorner mark={expenseLimitMark} glyphSize={13} />
              </div>
              <div
                className={cn(
                  "text-[30px] tracking-[-0.02em] leading-none mono text-ink",
                  limitBoldClass(expenseLimitMark?.effect) ?? "font-semibold",
                  limitTintClass(expenseLimitMark?.effect),
                )}
              >
                {formatCurrency(expenseCents, defaultCurrency)}
              </div>
              <div className="text-[12.5px] font-medium text-muted">
                <span className="mono">{expenseCount}</span> movimientos
              </div>
            </div>

            {/* Ingresos — mes.total.ingreso (tint NO ofrecido: monto tipado income-ink) */}
            <div
              className={cn(
                "bg-panel border border-line rounded-card shadow-(--shadow-sm) p-(--card-pad) flex flex-col gap-2.5 relative overflow-hidden",
                limitRingCardClass(incomeLimitMark?.effect),
              )}
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-chip bg-income-soft text-income-ink">
                  <ArrowUp size={14} aria-hidden="true" />
                </span>
                Ingresos
                <LimitMarkAdorner mark={incomeLimitMark} glyphSize={13} />
              </div>
              <div
                className={cn(
                  "text-[30px] tracking-[-0.02em] leading-none mono text-income-ink",
                  limitBoldClass(incomeLimitMark?.effect) ?? "font-semibold",
                )}
              >
                {formatCurrency(incomeCents, defaultCurrency)}
              </div>
              <div className="text-[12.5px] font-medium text-muted">
                <span className="mono">{incomeCount}</span> movimientos
              </div>
            </div>
          </div>

          {/* Balance hero — mes.balance (tint NO ofrecido: bloque de acento con signo) */}
          <div
            className={cn(
              "p-(--card-pad) rounded-card relative overflow-hidden text-white shadow-(--shadow-md)",
              limitRingCardClass(balanceLimitMark?.effect, "--shadow-md"),
            )}
            style={{
              background: "linear-gradient(135deg, var(--accent-press), var(--accent))",
            }}
          >
            {/* Círculo decorativo relleno */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-15 -top-15 h-55 w-55 rounded-full"
              style={{ background: "oklch(1 0 0 / 0.08)" }}
            />
            {/* Círculo decorativo sólo borde */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-7.5 -bottom-22.5 h-50 w-50 rounded-full"
              style={{ border: "1px solid oklch(1 0 0 / 0.14)" }}
            />

            <p className="text-[12px] font-semibold uppercase tracking-widest text-white/70 relative flex items-center gap-1.75">
              Balance de {mesName.toLowerCase()}
              <LimitMarkAdorner mark={balanceLimitMark} glyphSize={13} />
            </p>
            <div
              className={cn(
                "text-[46px] tracking-tight leading-none my-2 mono relative",
                limitBoldClass(balanceLimitMark?.effect) ?? "font-semibold",
              )}
            >
              {formatBalanceAmount(balanceCents)}
            </div>

            {/* Barra de proporción */}
            <div
              className="relative flex h-1.75 overflow-hidden rounded-pill mt-4.5"
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
            <div className="flex justify-between text-[12px] text-white/80 mt-2.25 relative">
              <span>
                Ingresos{" "}
                <b className="text-white font-semibold mono">{formatCurrency(incomeCents, defaultCurrency)}</b>
              </span>
              <span>
                Gastos{" "}
                <b className="text-white font-semibold mono">{formatCurrency(expenseCents, defaultCurrency)}</b>
              </span>
            </div>
          </div>

          {/* Estado vacío */}
          {!hasMovements && (
            <div className="rounded-card border border-dashed border-line bg-panel-2 px-6 py-8 text-center">
              <p className="text-[15px] font-semibold text-ink">
                Todavía no hay movimientos este mes
              </p>
              <p className="mt-1 text-[12.5px] leading-normal text-muted">
                Registrá tu primer gasto o ingreso de {mesName.toLowerCase()}.
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-ctl bg-accent text-white px-4 py-2.5 text-[14px] font-semibold shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0/0.2)] hover:bg-accent-press hover:-translate-y-px hover:shadow-(--shadow-md) transition-all duration-140 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <Plus size={16} aria-hidden="true" />
                Cargá tu primer movimiento
              </button>
            </div>
          )}

          {/* ── Widget Ingresos y gastos (RF-DASH-001, RF-REP-001/002) ──
              Modo efímero: navegación de año activa, filtro de categorías activo,
              pero el estado NO se persiste — al recargar vuelve a año en curso + todas.
              Ubicación: después del balance hero y ANTES del footer "Ver todos". */}
          <div className="mt-(--gap)">
            {/* Dashboard: sin onDirectionChange → modo decorativo (leyenda Ingresos/Gastos no interactiva). */}
            <ReportCard
              type="income-expense"
              year={reportYear}
              categoryIds={reportCategoryIds}
              chartHeight={280}
              onYearChange={setReportYear}
              onCategoryIdsChange={setReportCategoryIds}
              removable={false}
            />
          </div>

          {/* Footer de sección */}
          <div className="flex items-center justify-between mt-7 px-0.5">
            <span className="text-[14px] text-muted"></span>
            <Link
              href={`/mes?month=${month}`}
              className="inline-flex items-center gap-1.25 text-[14px] font-semibold text-accent-ink transition-[gap] duration-140 hover:gap-2"
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
