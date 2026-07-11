"use client";

/**
 * Card de detalle de movimiento — read-only (docs/design.md §"Card de detalle
 * de movimiento (`/mes`) — apertura, contenido read-only y fila adelgazada").
 *
 * Modal centrado sobre `ModalShell` (variante "dialog", max-w-[440px]).
 * No dispara fetch: renderiza el `MovementItem` que la fila ya tiene en
 * memoria. Sin loading/empty/error propios.
 *
 * Cierre (excepción justificada a la regla de modales — la card es read-only
 * y auxiliar): ✕, `Esc` Y clic en el scrim (`ModalShell` con
 * `closeOnScrimClick`), a diferencia de los modales de decisión.
 *
 * Card read-only pura: sin footer ni acción de edición — editar ya vive en
 * el kebab "⋮" de la fila (movement-item-row.tsx).
 */

import type { ReactNode } from "react";
import {
  Zap,
  Repeat,
  Receipt,
  CreditCard,
  ArrowDown,
  ArrowUp,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { ModalShell, ModalShellHeader, ModalShellBody } from "@/components/ui/modal-shell";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { useSettings } from "@/hooks/use-settings";
import { formatConvertedAmountDisplay, FREQUENCY_LABEL } from "@/lib/movements";
import { descaleOperand, buildFormulaExpression } from "@/lib/formula";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatMonthShort,
  formatExchangeRate,
  prevMonth,
  CURRENCY_SYMBOLS,
} from "@/lib/format";
import { PAYMENT_METHOD_TYPE_LABELS } from "@/types/payment-method";
import type { CalculatedChild, CalculatedInfo, MovementItem } from "@/types/movement";
import { cn } from "@/lib/utils";

interface MovementDetailCardProps {
  movement: MovementItem;
  onClose: () => void;
}

/** Capitaliza la primera letra — para el registro de ficha (vs. la variante minúscula de la fila) */
function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formatea un monto con signo (− / sin prefijo si es positivo o cero) — mismo lenguaje que el preview del form de calculado */
function formatSignedAmount(cents: number, currency: string): string {
  if (cents === 0) return formatCurrency(0, currency);
  if (cents < 0) return `−${formatCurrency(Math.abs(cents), currency)}`;
  return formatCurrency(cents, currency);
}

/** Fila rótulo·valor de la ficha — patrón reusable (docs/design.md §"Anatomía de la card") */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[2px]">
      <span className="text-[12.5px] font-medium text-muted shrink-0">{label}</span>
      <span className="text-right text-[13px] text-ink-2 min-w-0">{children}</span>
    </div>
  );
}

/** Fila "Vigencia" del fijo — arranque + fin (endMonth exclusivo → prevMonth) */
function VigenciaValue({ startMonth, endMonth }: { startMonth: string; endMonth: string | null }) {
  if (endMonth === null) {
    return (
      <span className="mono">
        Desde {formatMonthShort(startMonth)}
        <span className="text-muted"> · activo</span>
      </span>
    );
  }
  const lastActiveMonth = prevMonth(endMonth);
  if (lastActiveMonth === startMonth) {
    return <span className="mono">{formatMonthShort(startMonth)}</span>;
  }
  return (
    <span className="mono">
      {formatMonthShort(startMonth)} – {formatMonthShort(lastActiveMonth)}
    </span>
  );
}

/** Bloque del calculado — Origen (read-only) + Fórmula legible con resultado y badge de tipo derivado */
function CalculatedBlock({ movement, calc }: { movement: MovementItem; calc: CalculatedInfo }) {
  const isExpense = movement.type === "EXPENSE";
  const userOperand = descaleOperand(calc.formulaOperand, calc.formulaOperator);
  const expression = buildFormulaExpression(
    calc.sourceAmountCents,
    calc.formulaOperator,
    userOperand,
    movement.currency,
  );
  const resultDisplay = formatSignedAmount(movement.amountCents, movement.currency);

  return (
    <div className="space-y-[14px]">
      {/* Origen (read-only) */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Origen</span>
        <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]">
          {calc.sourceType === "fijo" && (
            <Repeat size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
          )}
          {calc.sourceType === "unico" && (
            <Receipt size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
          )}
          {calc.sourceType === "cuota" && (
            <CreditCard size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
          )}
          <span className="text-[14px] font-semibold text-ink-2 flex-1 min-w-0 truncate">
            {calc.sourceDescription ?? "Origen"}
          </span>
          {calc.sourceType === "fijo" && movement.frequency && (
            <span className="text-[12.5px] text-muted shrink-0 whitespace-nowrap">
              {FREQUENCY_LABEL[movement.frequency] ?? "mensual"}
            </span>
          )}
        </div>
      </div>

      {/* Fórmula — expresión legible + resultado + badge de tipo derivado */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Fórmula</span>
        <div className="flex items-center justify-between rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] gap-3">
          <span className="text-[12.5px] text-muted mono truncate">{expression}</span>
          <div className="flex flex-col items-end gap-[5px] shrink-0">
            <span className={cn("text-[16px] font-semibold mono", isExpense ? "text-ink" : "text-income-ink")}>
              {resultDisplay}
            </span>
            {isExpense ? (
              <span
                className="inline-flex items-center gap-[3px] rounded-[var(--r-chip)] bg-expense-soft text-expense-ink px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
                aria-label="Tipo derivado: Gasto"
              >
                <ArrowDownRight size={11} aria-hidden="true" />
                Gasto
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-[3px] rounded-[var(--r-chip)] bg-income-soft text-income-ink px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
                aria-label="Tipo derivado: Ingreso"
              >
                <ArrowUpRight size={11} aria-hidden="true" />
                Ingreso
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bloque "Calculados" — espejo del bloque "Origen": una caja por derivado, read-only */
function CalculatedChildrenBlock({
  calculatedChildren,
  defaultCurrency,
}: {
  calculatedChildren: CalculatedChild[];
  defaultCurrency: string;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Calculados</span>
      {calculatedChildren.map((child) => {
        const isExpense = child.type === "EXPENSE";
        // `convertedAmountCents` es una magnitud (≥ 0, ver CalculatedChild) — el signo
        // de presentación lo da `type`, igual criterio que formatConvertedAmountDisplay.
        const signedCents = isExpense ? -child.convertedAmountCents : child.convertedAmountCents;
        return (
          <div
            key={child.id}
            className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]"
          >
            {isExpense ? (
              <ArrowDownRight size={15} className="text-expense-ink shrink-0" aria-hidden="true" />
            ) : (
              <ArrowUpRight size={15} className="text-income-ink shrink-0" aria-hidden="true" />
            )}
            <span className="text-[14px] font-semibold text-ink-2 flex-1 min-w-0 truncate">
              {child.description ?? "Calculado"}
            </span>
            <span
              className={cn(
                "text-[13.5px] font-semibold mono shrink-0 whitespace-nowrap",
                isExpense ? "text-ink" : "text-income-ink",
              )}
            >
              {formatSignedAmount(signedCents, defaultCurrency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MovementDetailCard({ movement, onClose }: MovementDetailCardProps) {
  const { defaultCurrency } = useSettings();

  const isExpense = movement.type === "EXPENSE";
  const isCrossRate = movement.currency !== defaultCurrency;

  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

  const titleLabel = movement.description ?? movement.category.name;
  const amountDisplay = formatConvertedAmountDisplay(movement, defaultCurrency);
  const titleId = "movement-detail-title";

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={titleId} closeOnScrimClick>
      <ModalShellHeader titleId={titleId} title={titleLabel} onClose={onClose} />

      <ModalShellBody>
        {movement.skipped && (
          <span
            className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
            aria-label="Movimiento anulado para este mes"
          >
            Anulado
          </span>
        )}

        {/* Hero — ícono tintado + cifra convertida dominante + badge de moneda (cross-rate) */}
        <div className="flex items-center gap-[14px]">
          <span
            className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]", iconBg, iconColor)}
            aria-hidden="true"
          >
            <IconComponent size={19} strokeWidth={2.2} />
          </span>
          <span className="inline-flex items-center gap-[8px] min-w-0">
            <span
              className={cn(
                "text-[30px] font-semibold mono tracking-[-0.02em] truncate",
                isExpense ? "text-ink" : "text-income-ink",
                movement.skipped ? "line-through" : "",
              )}
            >
              {amountDisplay}
            </span>
            {isCrossRate && (
              <span
                className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] mono shrink-0"
                aria-label={`Moneda original: ${movement.currency}`}
              >
                {movement.currency}
              </span>
            )}
          </span>
        </div>

        <div className="h-px bg-hair" aria-hidden="true" />

        {/* Ficha — pares rótulo·valor */}
        <div className="space-y-[10px]">
          <DetailRow label="Categoría">
            <span className="inline-flex items-center gap-[6px] justify-end">
              <span
                className="h-[6px] w-[6px] rounded-full shrink-0"
                style={{ background: movement.category.color }}
                aria-hidden="true"
              />
              {movement.category.name}
            </span>
          </DetailRow>

          {movement.paymentMethod && (
            <DetailRow label="Método">
              <span className="inline-flex flex-col items-end gap-[2px]">
                <span className="inline-flex items-center gap-[6px] flex-wrap justify-end">
                  <PaymentMethodIcon icon={movement.paymentMethod.icon} size={14} className="text-ink-2 shrink-0" />
                  {movement.paymentMethod.name}
                  <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]">
                    {PAYMENT_METHOD_TYPE_LABELS[movement.paymentMethod.type]}
                  </span>
                </span>
                {movement.paymentMethod.type === "CREDIT" &&
                  (movement.paymentMethod.closingDay !== null || movement.paymentMethod.paymentDay !== null) && (
                    <span className="text-[11.5px] text-muted mono">
                      {[
                        movement.paymentMethod.closingDay !== null
                          ? `Cierre día ${movement.paymentMethod.closingDay}`
                          : null,
                        movement.paymentMethod.paymentDay !== null
                          ? `Cobro día ${movement.paymentMethod.paymentDay}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
              </span>
            </DetailRow>
          )}

          {movement.autoDebit === true && (
            <DetailRow label="Débito automático">
              <span className="inline-flex items-center gap-[6px] justify-end">
                <Zap size={14} className="text-muted shrink-0" aria-hidden="true" />
                Sí
              </span>
            </DetailRow>
          )}

          {isCrossRate && (
            <>
              <DetailRow label="Monto original">
                <span className="mono">
                  {formatCurrency(Math.abs(movement.amountCents), movement.currency)}
                </span>
              </DetailRow>
              <DetailRow label="Cotización">
                <span className="mono text-muted">
                  1 {movement.currency} = {CURRENCY_SYMBOLS[defaultCurrency] ?? "$"}
                  {formatExchangeRate(movement.exchangeRate)}
                </span>
              </DetailRow>
            </>
          )}

          {movement.origin === "unico" && movement.occurredAt && movement.timezone && (
            <DetailRow label="Fecha">
              <span className="mono">
                {formatDate(movement.occurredAt, movement.timezone)} ·{" "}
                {formatTime(movement.occurredAt, movement.timezone)}
              </span>
            </DetailRow>
          )}

          {movement.origin === "fijo" && (
            <>
              <DetailRow label="Frecuencia">
                {capitalize(movement.frequency ? (FREQUENCY_LABEL[movement.frequency] ?? "mensual") : "mensual")}
              </DetailRow>
              {movement.startMonth && (
                <DetailRow label="Vigencia">
                  <VigenciaValue startMonth={movement.startMonth} endMonth={movement.endMonth} />
                </DetailRow>
              )}
            </>
          )}

          {movement.origin === "cuota" && movement.installment && (
            <DetailRow label="Plan de cuotas">
              <span className="mono">
                Cuota {movement.installment.number} de {movement.installment.total}
              </span>
              <span className="text-muted"> · desde {formatMonthShort(movement.installment.startMonth)}</span>
            </DetailRow>
          )}
        </div>

        {/* Bloque del calculado — Origen + Fórmula (solo si es un movimiento calculado) */}
        {movement.calculated && (
          <>
            <div className="h-px bg-hair" aria-hidden="true" />
            <CalculatedBlock movement={movement} calc={movement.calculated} />
          </>
        )}

        {/* Bloque "Calculados" — derivados del origen (solo si el ítem es origen de ≥1 calculado en el mes) */}
        {movement.calculatedChildren.length >= 1 && (
          <>
            <div className="h-px bg-hair" aria-hidden="true" />
            <CalculatedChildrenBlock
              calculatedChildren={movement.calculatedChildren}
              defaultCurrency={defaultCurrency}
            />
          </>
        )}
      </ModalShellBody>
    </ModalShell>
  );
}
