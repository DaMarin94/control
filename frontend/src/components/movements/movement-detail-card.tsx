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
 *
 * Dos vistas (RF-VM-009): "detail" (siempre la de apertura, no dispara fetch)
 * y "evolution" (solo fijos no calculados ni simulados): reemplaza el cuerpo
 * por `FixedEvolutionCard` en su variante acotada, ensancha el panel a 640px y
 * hace que `Esc` vuelva al detalle (✕ y scrim siguen cerrando).
 */

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import {
  LineChart,
  ChevronRight,
  ChevronLeft,
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
import { FixedEvolutionCard } from "@/components/charts/fixed-evolution-card";
import type { FixedEvolutionRangeMonths } from "@/types/reports";
import { useSettings } from "@/hooks/use-settings";
import { formatConvertedAmountDisplay, FREQUENCY_LABEL } from "@/lib/movements";
import { descaleOperand, buildFormulaExpression } from "@/lib/formula";
import { addMonthsToKey } from "@/lib/recurring-skip-range";
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
  /**
   * Mes que se está visualizando en formato YYYY-MM — necesario para resolver
   * el "mes del monto base" (docs/design.md) del bloque Fórmula: el mes de
   * referencia real es `viewMonth − sourceMonthOffset`, y el backend solo
   * expone el offset (entero), no el mes ya resuelto.
   */
  viewMonth: string;
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
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
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
function CalculatedBlock({
  movement,
  calc,
  viewMonth,
}: {
  movement: MovementItem;
  calc: CalculatedInfo;
  viewMonth: string;
}) {
  const isExpense = movement.type === "EXPENSE";
  const userOperand = descaleOperand(calc.formulaOperand, calc.formulaOperator);
  const expression = buildFormulaExpression(
    calc.sourceAmountCents,
    calc.formulaOperator,
    userOperand,
    movement.currency,
  );
  const resultDisplay = formatSignedAmount(movement.amountCents, movement.currency);
  // "Mes del monto base" (docs/design.md) — solo si el desfasaje es > 0. El
  // backend ya resuelve `sourceAmountCents` sobre el mes de referencia; acá
  // solo se calcula el MES en sí (viewMonth − offset) para la sublínea.
  const sourceMonthOffset = calc.sourceMonthOffset ?? 0;
  const baseMonthLabel =
    sourceMonthOffset > 0 ? formatMonthShort(addMonthsToKey(viewMonth, -sourceMonthOffset)) : null;

  return (
    <div className="space-y-3.5">
      {/* Origen (read-only) */}
      <div className="flex flex-col gap-1.75">
        <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Origen</span>
        <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-3.25 py-2.75">
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
      <div className="flex flex-col gap-1.75">
        <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Fórmula</span>
        <div className="flex items-center justify-between rounded-ctl border border-line bg-panel-2 px-3.25 py-2.75 gap-3">
          {/* Celda izquierda: expresión + sublínea "Monto base" (solo desfasaje > 0) — mismo
              par expresión+sublínea que el preview del form de calculado */}
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="text-[12.5px] text-muted mono truncate w-full">{expression}</span>
            {baseMonthLabel && (
              <span className="text-[11.5px] text-muted truncate w-full">Monto base: {baseMonthLabel}</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.25 shrink-0">
            <span className={cn("text-[16px] font-semibold mono", isExpense ? "text-ink" : "text-income-ink")}>
              {resultDisplay}
            </span>
            {isExpense ? (
              <span
                className="inline-flex items-center gap-0.75 rounded-(--r-chip) bg-expense-soft text-expense-ink px-1.75 py-px text-[11px] font-semibold tracking-[0.04em]"
                aria-label="Tipo derivado: Gasto"
              >
                <ArrowDownRight size={11} aria-hidden="true" />
                Gasto
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-0.75 rounded-(--r-chip) bg-income-soft text-income-ink px-1.75 py-px text-[11px] font-semibold tracking-[0.04em]"
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
    <div className="flex flex-col gap-1.75">
      <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Calculados</span>
      {calculatedChildren.map((child) => {
        const isExpense = child.type === "EXPENSE";
        // `convertedAmountCents` es una magnitud (≥ 0, ver CalculatedChild) — el signo
        // de presentación lo da `type`, igual criterio que formatConvertedAmountDisplay.
        const signedCents = isExpense ? -child.convertedAmountCents : child.convertedAmountCents;
        return (
          <div
            key={child.id}
            className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-3.25 py-2.75"
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

/** Fundido del contenido entrante al cambiar de vista (140ms ease-out; instantáneo con reduced-motion). */
const VIEW_FADE_CLASS = "animate-[fadeIn_140ms_ease-out_both] motion-reduce:animate-none";

/** Rango por defecto de la vista evolución (RF-VM-009): 1 año. No persistido: cada entrada arranca acá. */
const EVOLUTION_DEFAULT_RANGE: FixedEvolutionRangeMonths = 12;

const EVOLUTION_UNAVAILABLE_MOTIVE = "Hacen falta al menos dos meses con monto para ver la evolución.";

/**
 * Acceso "Ver evolución" (item 7 de la card): fila de navegación "drill-in".
 * Deshabilitado = grisado con `aria-disabled` (nunca `disabled` nativo: el
 * motivo tiene que seguir alcanzable con teclado) + motivo por title/describedby.
 */
const NAV_ROW_BOX =
  "flex w-full items-center gap-2.5 min-h-11 rounded-ctl border border-line bg-panel px-3.25 py-2.5 text-left focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]";
const NAV_ROW_ENABLED = "group cursor-pointer transition-colors duration-140 hover:bg-panel-2 hover:border-line-strong active:bg-panel-3";

/** Fila "Volver al detalle" (pie de la vista evolución): espejo del acceso, chevron a la izquierda, nunca deshabilitada. */
function BackToDetailRow({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className={cn(NAV_ROW_BOX, NAV_ROW_ENABLED)}>
      <ChevronLeft
        size={16}
        className="shrink-0 text-faint transition-colors duration-140 group-hover:text-muted"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 text-[14px] font-semibold text-ink-2 transition-colors duration-140 group-hover:text-ink">
        Volver al detalle
      </span>
    </button>
  );
}

function EvolutionAccess({
  available,
  onOpen,
  buttonRef,
}: {
  available: boolean;
  onOpen: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  const motiveId = useId();
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-disabled={!available || undefined}
        aria-describedby={available ? undefined : motiveId}
        title={available ? undefined : EVOLUTION_UNAVAILABLE_MOTIVE}
        onClick={() => {
          if (!available) return;
          onOpen();
        }}
        className={cn(
          NAV_ROW_BOX,
          available ? NAV_ROW_ENABLED : "opacity-45 cursor-default",
        )}
      >
        <LineChart size={15} className="shrink-0 text-ink-2" aria-hidden="true" />
        <span
          className={cn(
            "flex-1 min-w-0 text-[14px] font-semibold text-ink-2 transition-colors duration-140",
            available && "group-hover:text-ink",
          )}
        >
          Ver evolución
        </span>
        <ChevronRight
          size={16}
          className={cn("shrink-0 text-faint transition-colors duration-140", available && "group-hover:text-muted")}
          aria-hidden="true"
        />
      </button>
      {!available && (
        <span id={motiveId} className="sr-only">
          {EVOLUTION_UNAVAILABLE_MOTIVE}
        </span>
      )}
    </>
  );
}

/**
 * Cuerpo de la vista evolución: la card `fixed-evolution` en su variante
 * acotada (docs/design.md §15). Es dueña del rango (default 1 año, sin
 * persistir): al montarse solo en la vista evolución, cada entrada arranca en
 * `EVOLUTION_DEFAULT_RANGE`.
 */
function EvolutionView({ chainId, onBack }: { chainId: string; onBack: () => void }) {
  const [rangeMonths, setRangeMonths] = useState<FixedEvolutionRangeMonths>(EVOLUTION_DEFAULT_RANGE);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Foco al entrar: disparador del RangeSelect (primer control del contenido nuevo).
  useEffect(() => {
    wrapperRef.current?.querySelector<HTMLElement>('button[aria-haspopup="listbox"]')?.focus();
  }, []);
  return (
    <div ref={wrapperRef} className="space-y-3.5">
      <FixedEvolutionCard chainId={chainId} rangeMonths={rangeMonths} onRangeMonthsChange={setRangeMonths} />
      <div className="h-px bg-hair" aria-hidden="true" />
      <BackToDetailRow onBack={onBack} />
    </div>
  );
}

export function MovementDetailCard({ movement, onClose, viewMonth }: MovementDetailCardProps) {
  const { defaultCurrency } = useSettings();

  // Vista actual de la card. Siempre abre en "detail": la card se monta al abrir y se
  // desmonta al cerrar, así que el estado se resetea por construcción.
  const [view, setView] = useState<"detail" | "evolution">("detail");
  const accessRef = useRef<HTMLButtonElement>(null);
  const cameFromEvolutionRef = useRef(false);

  // Foco de vuelta: acceso "Ver evolución" (el de entrada lo maneja EvolutionView).
  useEffect(() => {
    if (view === "detail" && cameFromEvolutionRef.current) {
      cameFromEvolutionRef.current = false;
      accessRef.current?.focus();
    }
  }, [view]);

  const hasEvolutionAccess =
    movement.origin === "fijo" && movement.calculated === null && !movement.simulated && movement.chainId !== null;
  const isEvolutionView = view === "evolution" && hasEvolutionAccess;

  // La primera apertura NO fade-ea (ya tiene `animate-modal-pop` del shell); el detalle solo
  // se fundido-entra al VOLVER de la evolución.
  const [returnedFromEvolution, setReturnedFromEvolution] = useState(false);

  function backToDetail() {
    cameFromEvolutionRef.current = true;
    setReturnedFromEvolution(true);
    setView("detail");
  }

  // `Esc` en evolución vuelve al detalle (en detalle cierra, vía el default del shell). Con el
  // listbox del rango abierto el primer `Esc` solo lo cierra (su propio handler, registrado
  // DESPUÉS del del shell): el shell lo ve todavía en el DOM y no hace nada.
  function handleEscape() {
    if (!isEvolutionView) {
      onClose();
      return;
    }
    if (document.querySelector('[role="listbox"]')) return;
    backToDetail();
  }

  const isExpense = movement.type === "EXPENSE";
  const isCrossRate = movement.currency !== defaultCurrency;

  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

  const titleLabel = movement.description ?? movement.category.name;
  const amountDisplay = formatConvertedAmountDisplay(movement, defaultCurrency);
  const titleId = "movement-detail-title";

  return (
    <ModalShell
      variant="dialog"
      onClose={onClose}
      onEscape={handleEscape}
      wide={isEvolutionView}
      labelledBy={titleId}
      closeOnScrimClick
    >
      <ModalShellHeader
        titleId={titleId}
        title={titleLabel}
        onClose={onClose}
      />

      {isEvolutionView && movement.chainId !== null ? (
        <ModalShellBody key="evolution" className={VIEW_FADE_CLASS}>
          <EvolutionView chainId={movement.chainId} onBack={backToDetail} />
        </ModalShellBody>
      ) : (
      <ModalShellBody key="detail" className={cn(returnedFromEvolution && VIEW_FADE_CLASS)}>
        {movement.skipped && (
          <span
            className="inline-flex items-center rounded-(--r-chip) bg-panel-3 text-muted px-1.75 py-px text-[11px] font-semibold tracking-[0.04em]"
            aria-label="Movimiento anulado para este mes"
          >
            Anulado
          </span>
        )}

        {/* Hero — ícono tintado + cifra convertida dominante + badge de moneda (cross-rate) */}
        <div className="flex items-center gap-3.5">
          <span
            className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]", iconBg, iconColor)}
            aria-hidden="true"
          >
            <IconComponent size={19} strokeWidth={2.2} />
          </span>
          <span className="inline-flex items-center gap-2 min-w-0">
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
                className="inline-flex items-center rounded-(--r-chip) bg-panel-3 text-muted px-1.75 py-px text-[11px] font-semibold tracking-[0.04em] mono shrink-0"
                aria-label={`Moneda original: ${movement.currency}`}
              >
                {movement.currency}
              </span>
            )}
          </span>
        </div>

        <div className="h-px bg-hair" aria-hidden="true" />

        {/* Ficha — pares rótulo·valor */}
        <div className="space-y-2.5">
          <DetailRow label="Categoría">
            <span className="inline-flex items-center gap-1.5 justify-end">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: movement.category.color }}
                aria-hidden="true"
              />
              {movement.category.name}
            </span>
          </DetailRow>

          {movement.paymentMethod && (
            <DetailRow label="Método">
              <span className="inline-flex flex-col items-end gap-0.5">
                <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                  <PaymentMethodIcon icon={movement.paymentMethod.icon} size={14} className="text-ink-2 shrink-0" />
                  {movement.paymentMethod.name}
                  <span className="inline-flex items-center rounded-(--r-chip) bg-panel-3 text-muted px-1.75 py-px text-[11px] font-semibold tracking-[0.04em]">
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
              <span className="inline-flex items-center gap-1.5 justify-end">
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
            <>
              <DetailRow label="Plan de cuotas">
                <span className="mono">
                  Cuota {movement.installment.number} de {movement.installment.total}
                </span>
                <span className="text-muted"> · desde {formatMonthShort(movement.installment.startMonth)}</span>
              </DetailRow>

              {/* Total del plan — derivado (monto por cuota × cantidad), moneda ORIGINAL
                  en cross-rate (nunca se convierte ni se extrapola la cotización de la
                  cuota al plan entero). Ver docs/design.md §"Total del plan de cuotas". */}
              {movement.installment.total > 1 && (
                <DetailRow label="Total del plan">
                  <span className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                    <span className="mono whitespace-nowrap">
                      {formatCurrency(
                        Math.abs(movement.amountCents) * movement.installment.total,
                        movement.currency,
                      )}
                    </span>
                    {isCrossRate && (
                      <span
                        className="inline-flex items-center rounded-(--r-chip) bg-panel-3 text-muted px-1.75 py-px text-[11px] font-semibold tracking-[0.04em] mono shrink-0"
                        aria-label={`Total del plan en ${movement.currency}`}
                      >
                        {movement.currency}
                      </span>
                    )}
                  </span>
                </DetailRow>
              )}
            </>
          )}
        </div>

        {/* Bloque del calculado — Origen + Fórmula (solo si es un movimiento calculado) */}
        {movement.calculated && (
          <>
            <div className="h-px bg-hair" aria-hidden="true" />
            <CalculatedBlock movement={movement} calc={movement.calculated} viewMonth={viewMonth} />
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

        {/* Acceso "Ver evolución" (RF-VM-009) — siempre el ÚLTIMO elemento del cuerpo. Solo fijo no
            calculado ni simulado; grisado con motivo si `evolutionAvailable` es false. */}
        {hasEvolutionAccess && (
          <>
            <div className="h-px bg-hair" aria-hidden="true" />
            <EvolutionAccess
              available={movement.evolutionAvailable === true}
              onOpen={() => setView("evolution")}
              buttonRef={accessRef}
            />
          </>
        )}
      </ModalShellBody>
      )}
    </ModalShell>
  );
}
