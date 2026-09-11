"use client";

/**
 * FixedEvolutionCard — Card de reporte "Detalle histórico de gastos fijos" (Ola 5, P6, RF-REP-013).
 *
 * Gráfico de líneas anual (Recharts LineChart) con UNA LÍNEA POR GASTO FIJO —
 * sin total, sin suma, sin agregación de ningún tipo. Alcance: solo fijos EXPENSE
 * (más sus calculados derivados); no cuotas, no únicos, no fijos de ingreso.
 *
 * Piezas propias de esta card (no existían antes en el lenguaje visual):
 *   1. Clave de color por fijo: `category.color` re-anclado en OKLCH a la banda
 *      de trazo legible (tres peldaños claro/medio/oscuro, hue y croma
 *      conservados) + desempate por orden de `ordinal` dentro del mismo hex de
 *      categoría (NUNCA por el índice del array, que varía con el año) — ver
 *      `lib/fixed-evolution-colors.ts`.
 *   2. El hueco como dato: la ausencia NO se grafica en cero; el motivo del hueco
 *      es alcanzable en el tooltip de línea destacada.
 *   3. Destacado por hover: aísla una línea sin tocar la selección.
 *   4. Leyenda-selector de fijos: reemplaza al filtro de categorías.
 *
 * Modo de visualización: 2 tabs (Montos / Variación) + 1 chip modificador
 * (Ajustada por inflación, solo aplica a Variación). Los 3 modos vienen
 * CALCULADOS del backend (`amountCents`, `nominalPct`, `adjustedPct`); el
 * front no deriva variaciones.
 *
 * Spec visual: docs/design.md §"Reporte 'Detalle histórico de gastos fijos' —
 * gráfico de líneas por fijo (fixed-evolution)".
 *
 * Gotchas:
 *   - `amountCents: 0` con `reason: null` es un punto REAL (RN-018); el hueco es
 *     `amountCents: null` + `reason` no-null. No colapsar ambos casos.
 *   - El color se asigna por `ordinal` (estable entre años), nunca por el índice
 *     del array `lines` (que varía con el año, ordenado por gasto anual DESC).
 *   - Recharts v3 `Line` no expone `onMouseEnter`/`onMouseLeave` sobre el trazo
 *     (sí lo hacen `Bar`/`Scatter`/`Funnel`). El disparador "hover sobre la línea"
 *     se implementa vía los puntos (`dot`/`activeDot`, visibles en reposo por
 *     spec) en vez de sobre el `path` — cobertura densa (12 puntos reales por
 *     línea) y evita hackear un `shape` custom con `Curve` + hit-path invisible.
 *   - `connectNulls`: true en Montos (huecos internos no parten la línea),
 *     false en los modos de variación (el hueco ahí es "no computable").
 *   - `type="linear"` (no monotone, no step): un aumento se lee como escalón.
 *   - `isAnimationActive={false}` en TODAS las `Line`: la animación de dibujado
 *     de Recharts (anima vía `stroke-dasharray`, calculada sobre
 *     `path.getTotalLength()`) quedaba congelada a mitad de camino —
 *     stroke-dasharray clavado en ~0,5% del recorrido, sin progresar— al
 *     cambiar de tab (Montos ⇄ Variación) sobre un LineChart ya montado; solo
 *     recargando la página se dibujaban bien. No se pudo aislar la causa raíz
 *     exacta en Recharts 3.8.1 (animationId/JavascriptAnimate) con certeza
 *     razonable, así que se desactivó la animación de entrada para esta card
 *     en vez de arriesgar otro fix parcial — las líneas deben verse siempre,
 *     en cualquier orden de interacción. Esto es una desviación del spec de
 *     animación de entrada de docs/design.md §10 (pendiente de actualizar por
 *     control-design). El `strokeDasharray="6 4"` del calculado se sigue
 *     aplicando igual (estático, no depende de la animación).
 */

import { useState, useEffect, useRef, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Pencil,
  RefreshCw,
  Eye,
  EyeOff,
  CornerDownRight,
  Repeat,
} from "lucide-react";
import { useFixedEvolution } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { ChartContainer } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import { assignFixedEvolutionColors } from "@/lib/fixed-evolution-colors";
import { FREQUENCY_LABEL } from "@/lib/movements";
import { formatCurrency, CURRENCY_SYMBOLS, getLocalTodayString, formatMonthShort } from "@/lib/format";
import type { FixedEvolutionLine, FixedEvolutionMonthPoint } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTH_LABELS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CHART_PANEL_ID = "fixed-evolution-chart-panel";

type FixedMode = "amounts" | "variation";
type EffectiveMode = "amounts" | "nominal" | "adjusted";

function getEffectiveMode(mode: FixedMode, adjusted: boolean): EffectiveMode {
  if (mode === "amounts") return "amounts";
  return adjusted ? "adjusted" : "nominal";
}

function getPointValue(point: FixedEvolutionMonthPoint, mode: EffectiveMode): number | null {
  if (mode === "amounts") return point.amountCents;
  if (mode === "nominal") return point.nominalPct;
  return point.adjustedPct;
}

// ─── Hook: prefers-reduced-motion ─────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

/** +8,3% / −2,1% / 0% (U+2212 minus, coma es-AR). */
function formatPct(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return "0%";
}

/** Formato del eje Y de montos: $0, $50k, $120k, $2,5M (coma es-AR). */
function makeAmountTickFormatter(currency: string): (valueCents: number) => string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  return function formatTick(valueCents: number): string {
    const pesos = valueCents / 100;
    if (pesos === 0) return `${sym}0`;
    if (pesos >= 1_000_000) {
      const m = pesos / 1_000_000;
      const label = m % 1 === 0 ? String(m) : m.toFixed(1).replace(".", ",");
      return `${sym}${label}M`;
    }
    if (pesos >= 1_000) {
      const k = pesos / 1_000;
      const label = k % 1 === 0 ? String(k) : k.toFixed(1).replace(".", ",");
      return `${sym}${label}k`;
    }
    return `${sym}${pesos}`;
  };
}

/** Motivo del hueco (docs/design.md §4) — copy único por causa, sin condicionales. */
function getGapMotive(
  point: FixedEvolutionMonthPoint,
  mode: EffectiveMode,
  line: FixedEvolutionLine,
  monthShortLabel: string,
): string {
  if (point.reason === "frequency") {
    return `No corresponde este mes — ${FREQUENCY_LABEL[line.frequency] ?? "mensual"}.`;
  }
  if (point.reason === "skipped") return "Mes anulado.";
  if (point.reason === "beforeStart") {
    return `Todavía no arrancaba — desde ${formatMonthShort(line.startMonth)}.`;
  }
  if (point.reason === "afterEnd") {
    return line.endMonth
      ? `Dado de baja — hasta ${formatMonthShort(line.endMonth)}.`
      : "Dado de baja.";
  }
  if (point.reason === "resultedIncome") return "Este mes resultó ingreso.";
  // reason === null: en modos de variación, puede faltar el cómputo aunque hubo monto.
  if (mode === "nominal") return "Sin variación computable — falta el monto del mes anterior.";
  if (mode === "adjusted") {
    if (point.nominalPct === null) return "Sin variación computable — falta el monto del mes anterior.";
    return `Sin IPC para ${monthShortLabel}.`;
  }
  return "Sin dato este mes.";
}

/** Primer/último índice (0-11) con valor no nulo en un arreglo de 12 valores. */
function getExtremes(values: ReadonlyArray<number | null>): { first: number; last: number } {
  let first = -1;
  let last = -1;
  values.forEach((v, i) => {
    if (v !== null) {
      if (first === -1) first = i;
      last = i;
    }
  });
  return { first, last };
}

// ─── Swatch (cuadrado pleno/hueco o mini-línea dasheada) ─────────────────────

interface SwatchProps {
  color: string;
  dashed: boolean;
  size?: number;
  hollow?: boolean;
  dimmedDash?: boolean;
}

function Swatch({ color, dashed, size = 8, hollow = false, dimmedDash = false }: SwatchProps) {
  if (dashed) {
    return (
      <span aria-hidden="true" className="shrink-0 inline-flex items-center" style={{ width: 14, height: Math.max(size, 8) }}>
        <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
          <line x1="0" y1="1" x2="14" y2="1" stroke={color} strokeWidth="2" strokeDasharray="6 4" opacity={dimmedDash ? 0.45 : 1} />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-[3px]"
      style={{
        width: size,
        height: size,
        ...(hollow
          ? { background: "var(--panel)", border: `1.5px solid ${color}` }
          : { background: color }),
      }}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FixedEvolutionSkeleton({ height }: { height: number }) {
  return (
    <div role="status" aria-label="Cargando reporte">
      <SkeletonBlock height={height} radius="ctl" />
      <div className="mt-[14px] flex flex-wrap gap-[10px]">
        {[130, 100, 150, 90, 120].map((w, i) => (
          <SkeletonLine key={i} height={26} width={w} />
        ))}
      </div>
      <div className="mt-[8px] pt-[8px]" style={{ borderTop: "1px solid var(--hair)" }}>
        <SkeletonLine height={24} width={84} />
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function FixedEvolutionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="alert">
      <AlertTriangle size={20} aria-hidden="true" className="text-warning-ink" />
      <p className="text-[14px] text-ink-2">No se pudo cargar el reporte.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 shadow-[var(--shadow-sm)] transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      >
        Reintentar
      </button>
    </div>
  );
}

// ─── ViewTabs — Montos / Variación ─────────────────────────────────────────────

interface ViewTabsProps {
  value: FixedMode;
  onChange: (v: FixedMode) => void;
}

const MODE_TABS: ReadonlyArray<{ label: string; id: string; val: FixedMode }> = [
  { label: "Montos", val: "amounts", id: "tab-fe-montos" },
  { label: "Variación", val: "variation", id: "tab-fe-variacion" },
];

function ViewTabs({ value, onChange }: ViewTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const reducedMotionTabs = useReducedMotion();

  const selectedIndex = MODE_TABS.findIndex((t) => t.val === value);

  useEffect(() => {
    const btn = tabRefs.current[selectedIndex];
    if (!btn) return;
    setUnderline({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = MODE_TABS[(idx + 1) % MODE_TABS.length];
      if (next) onChange(next.val);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = MODE_TABS[(idx - 1 + MODE_TABS.length) % MODE_TABS.length];
      if (prev) onChange(prev.val);
    }
  }

  return (
    <div role="tablist" aria-label="Modo de visualización" className="relative flex items-end gap-[18px] pb-[2px]">
      {underline && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 h-[2px] bg-ink",
            reducedMotionTabs ? "" : "transition-[left,width] duration-[180ms] ease-out",
          )}
          style={{ left: underline.left, width: underline.width }}
        />
      )}
      {MODE_TABS.map((tab, i) => {
        const isSelected = tab.val === value;
        return (
          <button
            key={tab.id}
            id={tab.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={CHART_PANEL_ID}
            onClick={() => onChange(tab.val)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              "relative py-[6px] text-[13px] font-semibold leading-none",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "transition-colors duration-[140ms]",
              isSelected ? "text-ink" : "text-muted hover:text-ink-2 hover:shadow-[inset_0_-2px_0_var(--line-strong)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chip "Ajustada por inflación" — deshabilitado con motivo en Montos ──────

interface AdjustedChipProps {
  pressed: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function AdjustedChip({ pressed, disabled, onToggle }: AdjustedChipProps) {
  const motiveId = useId();
  const motive = "El ajuste por inflación solo aplica a la variación.";
  const isElevated = !disabled && pressed;

  return (
    <>
      <button
        type="button"
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled ? motiveId : undefined}
        title={disabled ? motive : undefined}
        onClick={() => {
          if (disabled) return;
          onToggle();
        }}
        className={cn(
          "inline-flex items-center px-[10px] py-[5px] rounded-[7px]",
          "text-[12.5px] font-semibold select-none",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          disabled
            ? "bg-panel-2 border border-line text-muted opacity-45 cursor-default"
            : isElevated
              ? "bg-panel border border-line-strong shadow-[var(--shadow-sm)] text-ink active:bg-panel-3"
              : "bg-panel-2 border border-line text-muted hover:text-ink-2 hover:border-line-strong active:bg-panel-3",
        )}
      >
        Ajustada por inflación
      </button>
      {disabled && (
        <span id={motiveId} className="sr-only">
          {motive}
        </span>
      )}
    </>
  );
}

// ─── YearStepper (topes propios de esta card) ────────────────────────────────

interface YearStepperProps {
  year: number;
  earliestYear: number | null;
  latestYear: number;
  onPrev: () => void;
  onNext: () => void;
}

function YearStepper({ year, earliestYear, latestYear, onPrev, onNext }: YearStepperProps) {
  const canGoPrev = earliestYear !== null && year > earliestYear;
  const canGoNext = year < latestYear;

  return (
    <div className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1" role="group" aria-label="Navegación de año">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Año anterior"
        aria-disabled={!canGoPrev}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoPrev
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <span className="mono text-[14.5px] font-semibold text-ink min-w-[52px] text-center select-none" aria-live="polite" aria-atomic="true">
        {year}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Año siguiente"
        aria-disabled={!canGoNext}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[140ms]",
          canGoNext
            ? "text-ink-2 hover:bg-panel-2 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            : "text-faint opacity-45 cursor-default",
        )}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── RemoveConfirmPopover ─────────────────────────────────────────────────────

interface RemoveConfirmPopoverProps {
  onConfirm: () => void;
  onCancel: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function RemoveConfirmPopover({ onConfirm, onCancel, anchorRef }: RemoveConfirmPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onCancel, anchorRef]);

  if (!mounted) return null;

  const content = (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[220px] rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] p-[12px_14px] animate-modal-pop"
      style={{ top: position.top, right: position.right }}
      role="dialog"
      aria-label="Confirmar quitar reporte"
    >
      <p className="text-[13px] text-ink mb-3">¿Quitar este reporte?</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-ctl border border-expense bg-expense-soft px-3 py-[6px] text-[13px] font-semibold text-expense-ink transition-colors duration-[140ms] hover:bg-expense hover:text-white focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]"
        >
          Quitar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-ctl border border-line bg-panel px-3 py-[6px] text-[13px] font-semibold text-ink-2 transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── EditableTitle ────────────────────────────────────────────────────────────

interface EditableTitleProps {
  titleProp: string | undefined;
  titlePlaceholder: string;
  displayTitle: string;
  isEditing: boolean;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onEditingValueChange: (v: string) => void;
  canEdit: boolean;
}

function EditableTitle({
  titleProp, titlePlaceholder, displayTitle, isEditing, editingValue,
  inputRef, onEdit, onCommit, onCancel, onEditingValueChange, canEdit,
}: EditableTitleProps) {
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        maxLength={60}
        value={editingValue}
        placeholder={titlePlaceholder}
        onChange={(e) => onEditingValueChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        aria-label="Título del reporte"
        className={cn(
          "text-[16px] font-semibold leading-tight text-ink",
          "bg-panel border border-[var(--line-strong)] rounded-[var(--r-ctl,10px)]",
          "px-[8px] py-[3px]",
          "min-w-0 flex-1",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          "placeholder:text-[var(--faint)]",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={canEdit ? onEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onEdit(); }
      }}
      aria-label={canEdit ? "Editar título del reporte" : undefined}
      disabled={!canEdit}
      className={cn(
        "group/title flex items-center gap-[6px] min-w-0",
        canEdit ? "cursor-text" : "cursor-default",
        "bg-transparent border-0 p-0 text-left",
        canEdit && "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-ctl,10px)]",
      )}
    >
      <span
        title={displayTitle}
        className={cn(
          "block text-[16px] font-semibold leading-tight truncate",
          titleProp ? "text-ink" : "text-[var(--faint)]",
        )}
      >
        {displayTitle}
      </span>
      {canEdit && (
        <Pencil
          size={14}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted",
            "opacity-0 transition-opacity duration-[140ms]",
            "group-hover/title:opacity-100 group-focus-visible/title:opacity-100",
            "motion-reduce:transition-none",
          )}
        />
      )}
    </button>
  );
}

// ─── CardControls — cluster derecho de la cabecera ────────────────────────────

interface CardControlsProps {
  year: number;
  earliestYear: number | null;
  latestYear: number;
  onPrev: () => void;
  onNext: () => void;
  onCurrencyChange: (c: CurrencyCode) => void;
  effectiveCurrency: CurrencyCode;
  removable: boolean;
  removeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onRemoveOpen: () => void;
  onRefresh: () => void;
  isFetching: boolean;
}

function CardControls({
  year, earliestYear, latestYear, onPrev, onNext, onCurrencyChange,
  effectiveCurrency, removable, removeButtonRef, onRemoveOpen, onRefresh, isFetching,
}: CardControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <YearStepper year={year} earliestYear={earliestYear} latestYear={latestYear} onPrev={onPrev} onNext={onNext} />
      <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
      <CardCurrencySelect value={effectiveCurrency} onChange={onCurrencyChange} />
      <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Actualizar reporte"
        aria-busy={isFetching}
        className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        <RefreshCw size={16} aria-hidden="true" className={cn(isFetching && "animate-spin motion-reduce:animate-none")} />
      </button>
      {removable && (
        <button
          ref={removeButtonRef}
          type="button"
          onClick={onRemoveOpen}
          aria-label="Quitar reporte"
          className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Tooltip custom (dos contenidos: modo mes / modo línea) ──────────────────

interface LineMeta {
  chainId: string;
  color: string;
  isCalculated: boolean;
  description: string | null;
  categoryName: string;
  originDescription: string | null;
  frequency: number;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  year: number;
  mode: EffectiveMode;
  currency: CurrencyCode;
  highlightedId: string | null;
  /** Universo visible (seleccionado), en orden canónico (gasto anual DESC). */
  visibleMeta: LineMeta[];
  /** chainId -> 12 valores del modo actual. */
  valuesByChain: Map<string, ReadonlyArray<number | null>>;
  /** chainId -> línea completa (para resolver el motivo del hueco). */
  lineByChain: Map<string, FixedEvolutionLine>;
}

function formatDominantValue(value: number, mode: EffectiveMode, currency: CurrencyCode): string {
  if (mode === "amounts") return formatCurrency(value, currency);
  return formatPct(value);
}

function CustomTooltip({
  active, label, year, mode, currency, highlightedId, visibleMeta, valuesByChain, lineByChain,
}: CustomTooltipProps) {
  if (!active || typeof label !== "string") return null;
  const monthIndex = MONTH_LABELS_SHORT.indexOf(label);
  if (monthIndex === -1) return null;
  const monthFull = MONTH_LABELS_FULL[monthIndex] ?? label;
  const monthShort = MONTH_LABELS_SHORT[monthIndex] ?? label;

  // ── Modo B: línea destacada — la ficha del fijo-mes ──
  if (highlightedId) {
    const meta = visibleMeta.find((m) => m.chainId === highlightedId) ?? null;
    const line = lineByChain.get(highlightedId) ?? null;
    if (!meta || !line) return null;
    const value = valuesByChain.get(highlightedId)?.[monthIndex] ?? null;
    const point = line.months[monthIndex] ?? null;

    return (
      <div
        role="tooltip"
        className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
        style={{ boxShadow: "var(--shadow-lg)", minWidth: "220px", maxWidth: "320px" }}
      >
        {/* Encabezado */}
        <div className="flex items-start gap-[7px]">
          <Swatch color={meta.color} dashed={meta.isCalculated} size={10} />
          <div className="min-w-0">
            <p className={cn("text-[12px] font-semibold truncate", meta.description ? "text-ink" : "text-muted")}>
              {meta.description ?? "Sin descripción"}
            </p>
            <p className="text-[11.5px] font-medium text-ink-2 truncate">
              {meta.categoryName}
              {meta.isCalculated && meta.originDescription && (
                <span className="inline-flex items-center gap-[4px] ml-[4px] text-muted">
                  · <CornerDownRight size={12} aria-hidden="true" /> desde <span className="text-ink-2">{meta.originDescription}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />

        {/* Cifra dominante / hueco */}
        {value !== null ? (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">{monthShort} {year}</p>
            <p className="mono text-[13px] font-semibold text-ink">{formatDominantValue(value, mode, currency)}</p>
          </div>
        ) : (
          <p className="mono text-[13px] text-faint">—</p>
        )}

        <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />

        {/* Frecuencia */}
        <div className="flex items-center justify-between gap-[10px]">
          <span className="text-[11.5px] font-medium text-ink-2">Frecuencia</span>
          <span className="inline-flex items-center gap-[5px] text-[11.5px] font-medium text-muted">
            <Repeat size={12} aria-hidden="true" />
            {FREQUENCY_LABEL[line.frequency] ?? "mensual"}
          </span>
        </div>

        {/* Motivo del hueco */}
        {value === null && point && (
          <>
            <div className="my-[7px]" style={{ borderTop: "1px solid var(--hair)" }} />
            <p className="text-[11.5px] font-medium text-ink-2">{getGapMotive(point, mode, line, monthShort)}</p>
          </>
        )}
      </div>
    );
  }

  // ── Modo A: sin línea destacada — lectura comparativa del mes ──
  const rows: Array<{ chainId: string; color: string; dashed: boolean; label: string; value: number }> = [];
  for (const meta of visibleMeta) {
    const value = valuesByChain.get(meta.chainId)?.[monthIndex] ?? null;
    if (value === null) continue;
    rows.push({ chainId: meta.chainId, color: meta.color, dashed: meta.isCalculated, label: meta.description ?? "Sin descripción", value });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.value - a.value);
  const shown = rows.slice(0, 8);
  const more = rows.length - shown.length;

  return (
    <div
      role="tooltip"
      className="rounded-ctl border border-line bg-panel px-3 py-[10px] text-[12.5px] font-medium"
      style={{ boxShadow: "var(--shadow-lg)", minWidth: "220px", maxWidth: "320px" }}
    >
      <p className="mb-[8px] font-semibold text-ink">{monthFull} {year}</p>
      <div className="flex flex-col gap-[5px]">
        {shown.map((row) => (
          <div key={row.chainId} className="flex items-center gap-[7px]">
            <Swatch color={row.color} dashed={row.dashed} size={8} />
            <span className="flex-1 text-ink-2 truncate">{row.label}</span>
            <span className="mono shrink-0 text-ink tabular-nums">{formatDominantValue(row.value, mode, currency)}</span>
          </div>
        ))}
        {more > 0 && (
          <p className="text-[11.5px] text-faint">+{more} más</p>
        )}
      </div>
    </div>
  );
}

// ─── Ticks custom del eje Y ────────────────────────────────────────────────────

interface CustomPctYTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
}

function CustomPctYTick({ x = 0, y = 0, payload }: CustomPctYTickProps) {
  if (payload === undefined) return null;
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontFamily: "var(--mono)", fontSize: "11.5px", fill: "var(--muted)" }}>
      {formatPct(payload.value)}
    </text>
  );
}

interface AmountYTickProps extends CustomPctYTickProps {
  formatter: (valueCents: number) => string;
}

/**
 * Tick del eje Y en modo Montos. Se pasa como elemento JSX (`tick={<AmountYTick .../>}`,
 * no como referencia a componente) porque Recharts clona el elemento inyectando
 * x/y/payload — mismo patrón que `CustomYTick` de `inflation-income-card.tsx`. El
 * `formatter` viaja como prop propia (Recharts preserva las props que no sobrescribe).
 */
function AmountYTick({ x = 0, y = 0, payload, formatter }: AmountYTickProps) {
  if (payload === undefined) return null;
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontFamily: "var(--mono)", fontSize: "11.5px", fill: "var(--muted)" }}>
      {formatter(payload.value)}
    </text>
  );
}

// ─── Dot / activeDot custom (hueco visible, extremos anillados, hover) ───────

function makeDotRenderer(
  chainId: string,
  color: string,
  values: ReadonlyArray<number | null>,
  firstIdx: number,
  lastIdx: number,
  isHighlightedLine: boolean,
  onHoverChain: (id: string | null) => void,
) {
  return function CustomDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined || index === undefined) return <g key={`d-${chainId}-${index}`} />;
    const value = values[index];
    if (value === null || value === undefined) return <g key={`d-${chainId}-${index}`} />;
    const isExtreme = index === firstIdx || index === lastIdx;
    const r = isHighlightedLine || isExtreme ? 3 : 2;
    const ringWidth = isHighlightedLine ? 2 : isExtreme ? 1.5 : 0;
    return (
      <g key={`d-${chainId}-${index}`}>
        <circle cx={cx} cy={cy} r={r} fill={color} stroke={ringWidth > 0 ? "var(--panel)" : "none"} strokeWidth={ringWidth} />
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => onHoverChain(chainId)}
          onMouseLeave={() => onHoverChain(null)}
        />
      </g>
    );
  };
}

function makeActiveDotRenderer(chainId: string, color: string, onHoverChain: (id: string | null) => void) {
  return function CustomActiveDot(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke="var(--panel)"
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHoverChain(chainId)}
        onMouseLeave={() => onHoverChain(null)}
      />
    );
  };
}

// ─── Área del gráfico con responsivo (300px / 220px < --bp-wide) ─────────────

interface ChartResponsiveAreaProps {
  desktopHeight: number;
  children: (height: number) => React.ReactNode;
}

function ChartResponsiveArea({ desktopHeight, children }: ChartResponsiveAreaProps) {
  return (
    <>
      <div className="@max-wide:hidden" style={{ height: desktopHeight }}>
        {children(desktopHeight)}
      </div>
      <div className="@wide:hidden" style={{ height: 220 }}>
        {children(220)}
      </div>
    </>
  );
}

// ─── Leyenda-selector de fijos ────────────────────────────────────────────────

interface FixedLegendProps {
  lines: FixedEvolutionLine[];
  colorByChain: Map<string, string>;
  selectedSet: Set<string>;
  valuesByChain: Map<string, ReadonlyArray<number | null>>;
  highlightedId: string | null;
  year: number;
  onToggle: (chainId: string) => void;
  onAllNone: (allOn: boolean) => void;
  onHighlight: (id: string | null) => void;
}

function FixedLegend({
  lines, colorByChain, selectedSet, valuesByChain, highlightedId, year, onToggle, onAllNone, onHighlight,
}: FixedLegendProps) {
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRegionRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setHasOverflow(el.scrollHeight > el.clientHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lines.length]);

  const allVisible = selectedSet.size === lines.length;
  const allNoneLabel = allVisible ? "Ninguna" : "Todas";
  const AllNoneIcon = allVisible ? EyeOff : Eye;

  return (
    <div className="mt-[14px]">
      <div
        ref={scrollRegionRef}
        className="max-h-[112px] overflow-y-auto overflow-x-hidden pr-[2px] legend-scroll-region"
        data-overflow={hasOverflow ? "true" : "false"}
      >
        <div role="group" aria-label="Elegir gastos fijos" className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] -mx-[6px]">
          {lines.map((line) => {
            const color = colorByChain.get(line.chainId) ?? "var(--muted)";
            const isSelected = selectedSet.has(line.chainId);
            const values = valuesByChain.get(line.chainId) ?? [];
            const hasTrace = values.some((v) => v !== null);
            const state: "selected" | "unselected" | "no-trace" = !isSelected ? "unselected" : hasTrace ? "selected" : "no-trace";
            const label = line.description ?? "Sin descripción";
            const isHighlighted = highlightedId === line.chainId;

            return (
              <button
                key={line.chainId}
                type="button"
                aria-pressed={isSelected}
                title={
                  state === "no-trace"
                    ? `Sin variación computable en ${year} — este fijo no tiene dos meses seguidos con monto.`
                    : label
                }
                onClick={() => onToggle(line.chainId)}
                onMouseEnter={() => onHighlight(line.chainId)}
                onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(line.chainId)}
                onBlur={() => onHighlight(null)}
                className={cn(
                  "group inline-flex items-center gap-[6px] px-[6px] py-[4px] rounded-[7px]",
                  "cursor-pointer transition-[background-color,opacity] duration-[140ms]",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                  isHighlighted ? "bg-panel-2" : "hover:bg-panel-2 active:bg-panel-3",
                  state === "unselected" ? "opacity-70" : "opacity-100",
                )}
              >
                {line.isCalculated ? (
                  <span className="inline-flex items-center gap-[3px] shrink-0">
                    <Swatch color={color} dashed size={11} dimmedDash={state === "unselected"} />
                    <CornerDownRight size={11} aria-hidden="true" className="text-muted" />
                  </span>
                ) : (
                  <Swatch color={color} dashed={false} size={10} hollow={state === "unselected"} />
                )}
                <span
                  title={label}
                  className={cn(
                    "text-[12.5px] font-medium select-none truncate",
                    state === "unselected" ? "text-muted line-through" : state === "no-trace" ? "text-muted" : "text-ink-2",
                  )}
                  style={{ maxWidth: 180 }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carril fijo del comando */}
      <div className="mt-[8px] pt-[8px] flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--hair)" }}>
        <button
          type="button"
          aria-label={allVisible ? "Ocultar todos los gastos fijos" : "Mostrar todos los gastos fijos"}
          onClick={() => onAllNone(!allVisible)}
          className="group inline-flex items-center gap-[6px] px-[8px] py-[4px] rounded-[7px] cursor-pointer transition-colors duration-[140ms] bg-panel-2 hover:bg-panel-3 active:bg-panel-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          <AllNoneIcon size={13} aria-hidden="true" className="shrink-0 text-muted transition-colors duration-[140ms] group-hover:text-ink" />
          <span className="text-[12px] font-semibold select-none text-ink-2 group-hover:text-ink transition-colors duration-[140ms]">
            {allNoneLabel}
          </span>
        </button>
        <span
          className="mono text-[11.5px] text-muted shrink-0"
          aria-label={`${selectedSet.size} de ${lines.length} gastos fijos seleccionados`}
          title={`${selectedSet.size} de ${lines.length} gastos fijos seleccionados`}
        >
          {selectedSet.size} / {lines.length}
        </span>
      </div>
    </div>
  );
}

// ─── FixedEvolutionCard — Props ───────────────────────────────────────────────

export interface FixedEvolutionCardProps {
  year: number;
  currency?: CurrencyCode;
  title?: string;
  titlePlaceholder?: string;
  removable?: boolean;
  chartHeight?: number;
  mode?: FixedMode;
  adjusted?: boolean;
  selectedIds?: string[] | null;
  onYearChange?: (year: number) => void;
  onCurrencyChange?: (c: CurrencyCode) => void;
  onTitleChange?: (title: string) => void;
  onRemove?: () => void;
  onModeChange?: (mode: FixedMode) => void;
  onAdjustedChange?: (adjusted: boolean) => void;
  onSelectedIdsChange?: (ids: string[] | null) => void;
}

// ─── FixedEvolutionCard ───────────────────────────────────────────────────────

export function FixedEvolutionCard({
  year,
  currency,
  title: titleProp,
  titlePlaceholder = "Reporte",
  removable = false,
  chartHeight = 300,
  mode = "amounts",
  adjusted = false,
  selectedIds = null,
  onYearChange,
  onCurrencyChange,
  onTitleChange,
  onRemove,
  onModeChange,
  onAdjustedChange,
  onSelectedIdsChange,
}: FixedEvolutionCardProps) {
  const { defaultCurrency } = useSettings();
  const effectiveCurrency = currency ?? defaultCurrency;
  const today = useMemo(() => getLocalTodayString(), []);

  const { data, isLoading, isError, isFetching, refetch } = useFixedEvolution(year, currency, today);

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Destacado por hover (efímero, no persiste, no toca la selección) ──────
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ── Edición de título ──────────────────────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  function startTitleEdit() {
    if (!onTitleChange) return;
    setEditingValue(titleProp ?? "");
    setIsEditingTitle(true);
  }
  function commitTitleEdit() {
    if (!isEditingTitle) return;
    setIsEditingTitle(false);
    onTitleChange?.(editingValue.trim());
  }
  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setEditingValue(titleProp ?? "");
  }
  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  function handlePrev() { onYearChange?.(year - 1); }
  function handleNext() {
    const latest = data?.latestYear ?? new Date().getFullYear();
    if (year < latest) onYearChange?.(year + 1);
  }

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const allChainIds = useMemo(() => lines.map((l) => l.chainId), [lines]);

  const selectedSet = useMemo(() => {
    if (selectedIds === null) return new Set(allChainIds);
    return new Set(selectedIds);
  }, [selectedIds, allChainIds]);

  function handleToggle(chainId: string) {
    const current = selectedIds === null ? allChainIds : selectedIds;
    const isCurrentlyActive = current.includes(chainId);
    let next: string[] | null;
    if (isCurrentlyActive) {
      const remaining = current.filter((id) => id !== chainId);
      next = remaining.length === allChainIds.length ? null : remaining;
    } else {
      const added = [...current, chainId];
      next = added.length === allChainIds.length ? null : added;
    }
    onSelectedIdsChange?.(next);
  }

  function handleAllNone(allOn: boolean) {
    onSelectedIdsChange?.(allOn ? null : []);
  }

  const effectiveMode = getEffectiveMode(mode, adjusted);
  const isAmounts = effectiveMode === "amounts";

  const colorByChain = useMemo(
    () => assignFixedEvolutionColors(lines.map((l) => ({ chainId: l.chainId, ordinal: l.ordinal, categoryColor: l.categoryColor }))),
    [lines],
  );

  const lineByChain = useMemo(() => new Map(lines.map((l) => [l.chainId, l])), [lines]);

  const valuesByChain = useMemo(() => {
    const map = new Map<string, ReadonlyArray<number | null>>();
    for (const line of lines) {
      map.set(line.chainId, line.months.map((m) => getPointValue(m, effectiveMode)));
    }
    return map;
  }, [lines, effectiveMode]);

  const visibleLines = useMemo(() => lines.filter((l) => selectedSet.has(l.chainId)), [lines, selectedSet]);

  const orderedForPaint = useMemo(() => {
    if (!highlightedId) return visibleLines;
    const rest = visibleLines.filter((l) => l.chainId !== highlightedId);
    const hi = visibleLines.find((l) => l.chainId === highlightedId);
    return hi ? [...rest, hi] : visibleLines;
  }, [visibleLines, highlightedId]);

  const visibleMeta: LineMeta[] = useMemo(
    () =>
      visibleLines.map((l) => ({
        chainId: l.chainId,
        color: colorByChain.get(l.chainId) ?? "var(--muted)",
        isCalculated: l.isCalculated,
        description: l.description,
        categoryName: l.categoryName,
        originDescription: l.originDescription,
        frequency: l.frequency,
      })),
    [visibleLines, colorByChain],
  );

  // ── Dominio del eje Y ──────────────────────────────────────────────────────
  const yDomain: [number, number] = useMemo(() => {
    if (isAmounts) {
      let maxVal = 0;
      for (const line of visibleLines) {
        for (const v of valuesByChain.get(line.chainId) ?? []) {
          if (v !== null && v > maxVal) maxVal = v;
        }
      }
      const domainMax = maxVal === 0 ? 10000 : Math.ceil(maxVal * 1.08);
      return [0, domainMax];
    }
    let minVal = 0;
    let maxVal = 0;
    for (const line of visibleLines) {
      for (const v of valuesByChain.get(line.chainId) ?? []) {
        if (v === null) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const pad = 2;
    const dMin = Math.floor(minVal - pad);
    const dMax = Math.ceil(maxVal + pad);
    return [Math.min(dMin, -pad), Math.max(dMax, pad)];
  }, [isAmounts, visibleLines, valuesByChain]);

  // ── Filas del chart (siempre 12 meses) ─────────────────────────────────────
  const chartRows = useMemo(() => {
    return MONTH_LABELS_SHORT.map((short, i) => {
      const row: Record<string, unknown> = { monthIndex: i, month: short, monthFull: MONTH_LABELS_FULL[i] };
      for (const line of visibleLines) {
        row[line.chainId] = valuesByChain.get(line.chainId)?.[i] ?? null;
      }
      return row;
    });
  }, [visibleLines, valuesByChain]);

  // ── Estados ─────────────────────────────────────────────────────────────────
  const isYearEmpty = Boolean(data) && lines.length === 0;
  const isNoneSelected = Boolean(data) && lines.length > 0 && selectedSet.size === 0;
  const isVariationEmpty =
    !isAmounts &&
    Boolean(data) &&
    lines.length > 0 &&
    !isNoneSelected &&
    visibleLines.every((l) => !(valuesByChain.get(l.chainId) ?? []).some((v) => v !== null));

  const earliestYear = data?.earliestYear ?? null;
  const latestYear = data?.latestYear ?? new Date().getFullYear();
  const displayTitle = titleProp ?? titlePlaceholder;

  const amountTickFormatter = useMemo(() => makeAmountTickFormatter(effectiveCurrency), [effectiveCurrency]);
  const yAxisTickElement = isAmounts ? <AmountYTick formatter={amountTickFormatter} /> : <CustomPctYTick />;

  function renderCanvas(height: number) {
    return (
      <ChartContainer height={height}>
        <LineChart data={chartRows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="var(--hair)" strokeWidth={1} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, fill: "var(--muted)" }}
            dy={4}
          />
          <YAxis domain={yDomain} axisLine={false} tickLine={false} tick={yAxisTickElement} width={isAmounts ? 56 : 44} />
          {!isAmounts && <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} strokeDasharray="0" />}
          <Tooltip
            cursor={{ stroke: "var(--hair)", strokeWidth: 1 }}
            content={
              <CustomTooltip
                year={year}
                mode={effectiveMode}
                currency={effectiveCurrency}
                highlightedId={highlightedId}
                visibleMeta={visibleMeta}
                valuesByChain={valuesByChain}
                lineByChain={lineByChain}
              />
            }
          />
          {orderedForPaint.map((line) => {
            const color = colorByChain.get(line.chainId) ?? "var(--muted)";
            const values = valuesByChain.get(line.chainId) ?? [];
            const isHi = highlightedId === line.chainId;
            const isDim = highlightedId !== null && !isHi;
            const { first, last } = getExtremes(values);
            return (
              <Line
                key={line.chainId}
                type="linear"
                dataKey={line.chainId}
                name={line.chainId}
                stroke={color}
                strokeWidth={isHi ? 2.5 : 2}
                strokeOpacity={isDim ? 0.18 : 1}
                strokeDasharray={line.isCalculated ? "6 4" : undefined}
                connectNulls={isAmounts}
                isAnimationActive={false}
                dot={
                  isDim
                    ? false
                    : (makeDotRenderer(line.chainId, color, values, first, last, isHi, setHighlightedId) as unknown as boolean)
                }
                activeDot={
                  isDim
                    ? false
                    : (makeActiveDotRenderer(line.chainId, color, setHighlightedId) as unknown as boolean)
                }
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade" aria-label={`${displayTitle} ${year}`}>
      {/* ── Línea 1: título editable ── */}
      <div className="mb-[8px] flex items-center gap-[6px]">
        <div className="min-w-0">
          <EditableTitle
            titleProp={titleProp}
            titlePlaceholder={titlePlaceholder}
            displayTitle={displayTitle}
            isEditing={isEditingTitle}
            editingValue={editingValue}
            inputRef={titleInputRef}
            onEdit={startTitleEdit}
            onCommit={commitTitleEdit}
            onCancel={cancelTitleEdit}
            onEditingValueChange={setEditingValue}
            canEdit={!!onTitleChange}
          />
        </div>
      </div>

      {/* ── Línea 2: [tabs + chip] izq / [controles] der ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        <div className="flex flex-wrap items-center gap-[6px]">
          <ViewTabs value={mode} onChange={(v) => onModeChange?.(v)} />
          <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
          <AdjustedChip pressed={adjusted} disabled={isAmounts} onToggle={() => onAdjustedChange?.(!adjusted)} />
        </div>
        <CardControls
          year={year}
          earliestYear={earliestYear}
          latestYear={latestYear}
          onPrev={handlePrev}
          onNext={handleNext}
          onCurrencyChange={(c) => onCurrencyChange?.(c)}
          effectiveCurrency={effectiveCurrency}
          removable={removable}
          removeButtonRef={removeButtonRef}
          onRemoveOpen={() => setRemoveOpen((o) => !o)}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* ── Área del gráfico ── */}
      {isError ? (
        <FixedEvolutionError onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <FixedEvolutionSkeleton height={chartHeight} />
      ) : (
        <>
          <div id={CHART_PANEL_ID} role="tabpanel" aria-labelledby={mode === "amounts" ? "tab-fe-montos" : "tab-fe-variacion"} className="relative">
            {isYearEmpty && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none" aria-live="polite">
                <p className="text-[14px] text-muted">Sin gastos fijos en {year}.</p>
              </div>
            )}
            {!isYearEmpty && isNoneSelected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Ningún gasto fijo seleccionado.</p>
                <p className="text-[12.5px] text-faint">Elegí uno en la lista de abajo.</p>
              </div>
            )}
            {!isYearEmpty && !isNoneSelected && isVariationEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none text-center px-4" aria-live="polite">
                <p className="text-[14px] text-muted">Sin variación computable en {year}.</p>
                <p className="text-[12.5px] text-faint">Cada línea necesita el monto de su mes anterior.</p>
              </div>
            )}
            <ChartResponsiveArea desktopHeight={chartHeight}>{(height) => renderCanvas(height)}</ChartResponsiveArea>
          </div>

          {!isYearEmpty && (
            <FixedLegend
              lines={lines}
              colorByChain={colorByChain}
              selectedSet={selectedSet}
              valuesByChain={valuesByChain}
              highlightedId={highlightedId}
              year={year}
              onToggle={handleToggle}
              onAllNone={handleAllNone}
              onHighlight={setHighlightedId}
            />
          )}
        </>
      )}

      {removeOpen && removable && (
        <RemoveConfirmPopover
          onConfirm={() => { setRemoveOpen(false); onRemove?.(); }}
          onCancel={() => setRemoveOpen(false)}
          anchorRef={removeButtonRef}
        />
      )}
    </div>
  );
}
