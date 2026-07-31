"use client";

/**
 * CuotasGanttCard — Card de reporte de gantt anual de gastos en Cuotas (Ola 3, P2).
 *
 * Implementa el canvas de gantt con barras horizontales posicionadas sobre una
 * grilla de 12 columnas (los meses del año):
 * - Header de meses sticky con gridlines verticales.
 * - Barras posicionadas con CSS Grid (grid-column + grid-row).
 * - Eje visual invertido: rowIndex=0 queda ABAJO (pegado al eje), los renglones
 *   crecen hacia arriba — el backend no invierte, lo hace el front.
 * - Indicadores ‹/› para barras que cruzan el borde del año (continuesBefore/continuesAfter).
 * - Etiqueta dentro/fuera de la barra según ancho disponible.
 * - Tooltip portaled a body con detalles de la barra (descripción, monto/cuota, período, etc.).
 * - Filtro de categorías: chips-toggle (ChartLegend) debajo del plot.
 * - Misma cabecera que las otras cards (título editable P4 + YearStepper +
 *   CardCurrencySelect + X).
 *
 * Spec visual: docs/design.md §"Reporte anual de Cuotas — gantt de barras horizontales (Ola 3, P2)".
 *
 * Gotchas:
 * - El packing viene del backend (rowIndex/rowCount); el front solo posiciona.
 * - rowIndex=0 es el renglón más cercano al eje X (abajo) → se invierte al renderizar.
 * - endMonthIndex es INCLUSIVO: barra [0,1] ocupa ene + feb completos.
 * - El color de la barra es el color de su categoría (nunca --expense rojo).
 * - Todo monto va en mono tabular tnum (regla dura 3).
 * - CSS nativo (NO Recharts) — misma postura que unique-grid.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useCuotasGantt } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { useLimits } from "@/hooks/use-limits";
import { computeInstallmentBarMark } from "@/lib/limits/apply-reports";
import { describeLimitMark, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { LimitGlyph, LimitBadge } from "@/components/limits/limit-mark";
import { LimitsInfoPopover } from "@/components/limits/limits-info-popover";
import { formatCurrency } from "@/lib/format";
import { ChartLegend } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import { useScrollShadow, getScrollShadowStyle } from "@/hooks/use-scroll-shadow";
import type { CuotasGanttBar, CuotasGanttResponse } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import type { LimitConfig } from "@/types/limit";
import { cn } from "@/lib/utils";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";
import { Eye, EyeOff } from "lucide-react";

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTH_LABELS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Alto de renglón objetivo en px. */
const ROW_HEIGHT = 30;
/** Alto de la barra dentro del renglón en px. */
const BAR_HEIGHT = 24;
/** Gap vertical entre renglones en px. */
const ROW_GAP = 6;
// MIN_COLS_FOR_INNER_LABEL eliminada — reemplazada por MIN_COLS_FOR_WIDE_LABEL en GanttBar.

// ─── Helpers de contraste de texto ───────────────────────────────────────────

/**
 * Parsea un color hex (#RRGGBB) a sus componentes RGB (0–255).
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Luminancia relativa (WCAG 2.x) de un color RGB [0-255].
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Devuelve el color de texto (oscuro o claro) para garantizar contraste
 * contra el color de fondo de la barra (hex).
 * Umbral 0.35: barras claras (L > 0.35) → texto oscuro; barras oscuras → texto claro.
 */
function getBarTextColor(barColorHex: string): string {
  const rgb = hexToRgb(barColorHex);
  if (!rgb) return "oklch(0.25 0.02 270)"; // fallback oscuro
  const lum = relativeLuminance(rgb[0], rgb[1], rgb[2]);
  return lum > 0.35
    ? "oklch(0.25 0.02 270)"   // texto oscuro sobre barra clara
    : "oklch(0.96 0.005 270)"; // texto claro sobre barra oscura
}

// ─── Hook: dark mode ──────────────────────────────────────────────────────────

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    function check() {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    }
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GanttSkeleton() {
  return (
    <div role="status" aria-label="Cargando reporte">
      {/* Header de meses fantasma */}
      <SkeletonBlock height={32} radius="ctl" />
      {/* Barras fantasma en 2-3 renglones */}
      <div className="mt-[6px] flex flex-col gap-[6px]">
        {/* Renglón 1: barra larga abarcando ~8 meses */}
        <div className="h-[24px] rounded-ctl animate-shimmer bg-panel-3" style={{ marginLeft: "8.33%", width: "66.66%" }} aria-hidden="true" />
        {/* Renglón 2: dos barras medianas */}
        <div className="flex gap-[1%]" aria-hidden="true">
          <div className="h-[24px] rounded-ctl animate-shimmer bg-panel-3" style={{ marginLeft: "0%", width: "33%" }} />
          <div className="h-[24px] rounded-ctl animate-shimmer bg-panel-3" style={{ width: "25%" }} />
        </div>
        {/* Renglón 3: barra corta */}
        <div className="h-[24px] rounded-ctl animate-shimmer bg-panel-3" style={{ marginLeft: "50%", width: "16.66%" }} aria-hidden="true" />
      </div>
      {/* Chips fantasma de filtro */}
      <div className="mt-[14px] flex gap-[8px]">
        {[80, 64, 72].map((w, i) => (
          <SkeletonLine key={i} height={28} width={w} />
        ))}
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function GanttError({ onRetry }: { onRetry: () => void }) {
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

// ─── YearStepper ─────────────────────────────────────────────────────────────

interface YearStepperProps {
  year: number;
  currentYear: number;
  onPrev: () => void;
  onNext: () => void;
}

function YearStepper({ year, currentYear, onPrev, onNext }: YearStepperProps) {
  const canGoNext = year < currentYear;
  // Navegación libre hacia atrás (sin earliestYear en el contrato de annual-cuotas)
  const canGoPrev = true;

  return (
    <div
      className="flex items-center rounded-pill border border-line bg-panel shadow-[var(--shadow-sm)] p-1"
      role="group"
      aria-label="Navegación de año"
    >
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
      <span
        className="mono text-[14.5px] font-semibold text-ink min-w-[52px] text-center select-none"
        aria-live="polite"
        aria-atomic="true"
      >
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

// ─── LegendAllChip ────────────────────────────────────────────────────────────

interface LegendAllChipProps {
  hiddenCategoryIds: string[];
  onCategoryIdsChange?: (ids: string[] | null) => void;
}

function LegendAllChip({ hiddenCategoryIds, onCategoryIdsChange }: LegendAllChipProps) {
  const allVisible = hiddenCategoryIds.length === 0;
  const label = allVisible ? "Ninguna" : "Todas";
  const ariaLabel = allVisible ? "Ocultar todas las categorías" : "Mostrar todas las categorías";
  const Icon = allVisible ? EyeOff : Eye;

  return (
    <>
      <div aria-hidden="true" className="my-[8px]" style={{ borderTop: "1px solid var(--hair)", width: "100%" }} />
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onCategoryIdsChange?.(allVisible ? [] : null)}
        className={cn(
          "group inline-flex items-center gap-[6px] px-[8px] py-[4px] rounded-[7px]",
          "cursor-pointer transition-colors duration-[140ms]",
          "bg-panel-2 hover:bg-panel-3 active:bg-panel-3",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        <Icon size={13} aria-hidden="true" className="shrink-0 text-muted transition-colors duration-[140ms] group-hover:text-ink" />
        <span className="text-[12px] font-semibold select-none text-ink-2 group-hover:text-ink transition-colors duration-[140ms]">
          {label}
        </span>
      </button>
    </>
  );
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

// ─── Tooltip de barra ─────────────────────────────────────────────────────────

interface BarTooltipState {
  bar: CuotasGanttBar;
  categoryName: string;
  categoryColor: string;
  x: number;
  y: number;
  /** Marca de límite (P2 — Tramo 2): reporte.cuotas.montoPorCuota / .cantidadCuotas. */
  mark: EvaluatedLimitMark | null;
}

/**
 * Parsea un "YYYY-MM" y devuelve { year, monthIndex } (0-based).
 */
function parseYearMonth(ym: string): { year: number; monthIndex: number } | null {
  const parts = ym.split("-");
  if (parts.length !== 2) return null;
  const y = parseInt(parts[0] ?? "", 10);
  const m = parseInt(parts[1] ?? "", 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  return { year: y, monthIndex: m - 1 };
}

/**
 * Formatea un "YYYY-MM" como "nov 2025" (mes corto minúscula + año).
 */
function formatYearMonth(ym: string): string {
  const parsed = parseYearMonth(ym);
  if (!parsed) return ym;
  const label = MONTH_LABELS_SHORT[parsed.monthIndex] ?? "";
  return `${label.toLowerCase()} ${parsed.year}`;
}

/**
 * Formatea el período REAL de la barra para el tooltip usando realStartMonth / realEndMonth.
 * Si son el mismo mes muestra un solo mes; si cruzan años muestra el año en ambos extremos.
 */
function formatBarPeriod(bar: CuotasGanttBar): string {
  const startFmt = formatYearMonth(bar.realStartMonth);
  const endFmt = formatYearMonth(bar.realEndMonth);
  if (bar.realStartMonth === bar.realEndMonth) {
    return startFmt;
  }
  return `${startFmt} – ${endFmt}`;
}

/**
 * Tooltip portaled con detalles de una barra de cuota.
 */
function BarTooltipPortal({
  tooltipState,
  currency,
}: {
  tooltipState: BarTooltipState;
  currency: string;
}) {
  const { bar, categoryName, categoryColor, x, y, mark } = tooltipState;
  const amountFmt = formatCurrency(bar.amountCents, currency);
  const periodFmt = formatBarPeriod(bar);
  const descriptionText = bar.description ?? null;

  return (
    <div
      className="fixed z-50 rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] px-[10px] py-[8px] pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        minWidth: 200,
      }}
      role="tooltip"
    >
      {/* Encabezado: swatch + descripción */}
      <div className="flex items-center gap-[7px] mb-[2px]">
        <div
          aria-hidden="true"
          className="shrink-0 rounded-[3px]"
          style={{ width: 8, height: 8, background: categoryColor }}
        />
        <span className="text-[12px] font-semibold text-ink truncate">
          {descriptionText !== null ? descriptionText : <span className="text-muted">Sin descripción</span>}
        </span>
      </div>
      {/* Nombre de la categoría */}
      <div className="text-[11.5px] font-medium text-ink-2 mb-[6px] ml-[15px]">
        {categoryName}
      </div>

      {/* Divisor */}
      <div aria-hidden="true" style={{ borderTop: "1px solid var(--hair)", marginBottom: 6 }} />

      {/* Monto dominante — por cuota */}
      <div className="flex items-baseline gap-[4px] mb-[6px]">
        <span className="mono text-[13px] font-semibold text-ink tabular-nums">{amountFmt}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">por cuota</span>
      </div>

      {/* Filas de detalle */}
      <div className="flex flex-col gap-[4px]">
        {/* Período */}
        <div className="flex items-center gap-[12px]">
          <span className="flex-1 text-[11.5px] font-medium text-ink-2">Período</span>
          <span className="shrink-0 text-[11px] font-medium text-ink-2">{periodFmt}</span>
        </div>

        {/* Cuotas */}
        <div className="flex items-center gap-[12px]">
          <span className="flex-1 text-[11.5px] font-medium text-ink-2">Cuotas</span>
          <span className="mono text-[11px] font-medium text-ink-2 tabular-nums shrink-0">
            {bar.totalInstallments} cuotas
          </span>
        </div>

        {/* Total del plan — derivado (monto por cuota × cantidad); moneda ya viene
            de display (currency del gantt), sin cross-rate acá. Se omite si total === 1
            (docs/design.md §"Total del plan de cuotas"). */}
        {bar.totalInstallments > 1 && (
          <div className="flex items-center gap-[12px]">
            <span className="flex-1 min-w-0 text-[11.5px] font-medium text-ink-2">Total del plan</span>
            <span className="mono text-[11px] font-medium text-ink-2 tabular-nums shrink-0 whitespace-nowrap">
              {formatCurrency(bar.amountCents * bar.totalInstallments, currency)}
            </span>
          </div>
        )}

        {/* Progreso — cuotas X a Y visibles */}
        {bar.installmentFrom !== bar.installmentTo ? (
          <div className="flex items-center gap-[12px]">
            <span className="flex-1 text-[11.5px] font-medium text-ink-2">Progreso</span>
            <span className="mono text-[11px] font-medium text-ink-2 tabular-nums shrink-0">
              cuotas {bar.installmentFrom}–{bar.installmentTo} visibles
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-[12px]">
            <span className="flex-1 text-[11.5px] font-medium text-ink-2">Progreso</span>
            <span className="mono text-[11px] font-medium text-ink-2 tabular-nums shrink-0">
              cuota {bar.installmentFrom} de {bar.totalInstallments}
            </span>
          </div>
        )}
      </div>

      {/* Nota de límite cruzado (P2 — Tramo 2): portador de a11y de la barra. */}
      {mark && (
        <>
          <div aria-hidden="true" style={{ borderTop: "1px solid var(--hair)", margin: "6px 0" }} />
          <div className="flex items-center gap-[6px]">
            <LimitGlyph tooltip={describeLimitMark(mark)} size={12} />
            <span className="text-[11.5px] font-medium text-warning-ink">{describeLimitMark(mark)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Umbral de columnas para considerar que la barra es "ancha" (entra monto + nombre).
 * Escalón 1: ≥ MIN_COLS_FOR_INNER_LABEL → monto + separador + nombre truncado.
 * Escalón 2: 1 columna → solo monto.
 * Escalón 3: ni el monto entra → solo monto afuera (OuterLabel).
 */
const MIN_COLS_FOR_WIDE_LABEL = 2; // reemplaza MIN_COLS_FOR_INNER_LABEL

// ─── Barra individual del gantt ───────────────────────────────────────────────

interface GanttBarProps {
  bar: CuotasGanttBar;
  categoryColor: string;
  categoryName: string;
  currency: string;
  /** Índice visual de fila (0 = arriba, rowCount-1 = abajo) — ya invertido respecto al rowIndex del backend. */
  visualRowIndex: number;
  /**
   * true = ni el monto cabe dentro; la etiqueta va afuera (OuterLabel).
   * En ese caso la barra no muestra ningún texto interno.
   */
  labelOutside: boolean;
  /** Marca de límite (P2 — Tramo 2): reporte.cuotas.montoPorCuota / .cantidadCuotas. */
  mark: EvaluatedLimitMark | null;
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, bar: CuotasGanttBar, color: string, name: string) => void;
  onMouseLeave: () => void;
}

function GanttBar({
  bar,
  categoryColor,
  categoryName,
  currency,
  visualRowIndex,
  labelOutside,
  mark,
  onMouseEnter,
  onMouseLeave,
}: GanttBarProps) {
  const textColor = getBarTextColor(categoryColor);
  const spanCols = bar.endMonthIndex - bar.startMonthIndex + 1;
  // Escalón 1 → ancha: monto + punto medio + nombre truncado
  // Escalón 2 → angosta (1 mes): solo monto, sin nombre
  const isWide = spanCols >= MIN_COLS_FOR_WIDE_LABEL;

  // Posición absoluta dentro del plot
  // Plot tiene rowCount renglones; visualRowIndex=0 es el de arriba
  const barTop = visualRowIndex * (ROW_HEIGHT + ROW_GAP) + Math.floor((ROW_HEIGHT - BAR_HEIGHT) / 2);

  // Porcentaje de left/width para las 12 columnas
  const leftPct = (bar.startMonthIndex / 12) * 100;
  const widthPct = (spanCols / 12) * 100;

  // Radio de la barra: lado izquierdo recto si continúa antes, lado derecho recto si continúa después
  const radiusLeft = bar.continuesBefore ? "0px" : "var(--r-ctl, 10px)";
  const radiusRight = bar.continuesAfter ? "0px" : "var(--r-ctl, 10px)";
  const borderRadius = `${radiusLeft} ${radiusRight} ${radiusRight} ${radiusLeft}`;

  const amountFmt = formatCurrency(bar.amountCents, currency);
  const descText = bar.description ?? "";
  const totalPlanFmt =
    bar.totalInstallments > 1
      ? ` · total ${formatCurrency(bar.amountCents * bar.totalInstallments, currency)}`
      : "";
  const ariaLabel = `${descText || "Sin descripción"}, ${categoryName}, ${amountFmt} por cuota, ${MONTH_LABELS_SHORT[bar.startMonthIndex] ?? ""} a ${MONTH_LABELS_SHORT[bar.endMonthIndex] ?? ""}${totalPlanFmt}${bar.continuesBefore ? ", continúa desde el año anterior" : ""}${bar.continuesAfter ? ", continúa en el año siguiente" : ""}${mark ? ` · ${describeLimitMark(mark)}` : ""}`;

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: barTop,
        height: BAR_HEIGHT,
        background: categoryColor,
        borderRadius,
        cursor: "default",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        transition: "filter 140ms",
        boxSizing: "border-box",
        // P2 — Tramo 2: reporte.cuotas.* (bar) — efecto "ring" envuelve la barra.
        boxShadow: mark?.effect === "ring" ? "inset 0 0 0 2px var(--warning)" : undefined,
      }}
      onMouseEnter={(e) => onMouseEnter(e, bar, categoryColor, categoryName)}
      onMouseLeave={onMouseLeave}
      onFocus={(e) => {
        // Para a11y: mostrar tooltip al hacer focus de teclado
        onMouseEnter(e as unknown as React.MouseEvent<HTMLDivElement>, bar, categoryColor, categoryName);
      }}
      onBlur={onMouseLeave}
      className="group/bar hover:brightness-[1.04] hover:shadow-[var(--shadow-sm)]"
      tabIndex={0}
    >
      {/* Chevron ‹ si continúa antes */}
      {bar.continuesBefore && (
        <span
          aria-hidden="true"
          className="shrink-0 pl-[4px] pointer-events-none"
          style={{ color: textColor }}
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
        </span>
      )}

      {/*
        Etiqueta interior según escalón:
        - labelOutside=true → escalón 3: pastilla de color pura, sin texto.
        - isWide → escalón 1: [monto] · [nombre truncado]
        - !isWide → escalón 2 (1 mes): solo [monto], sin nombre ni punto medio.
      */}
      {!labelOutside && (
        <span
          className="flex items-center min-w-0 pointer-events-none pl-[9px] pr-[9px] gap-[8px]"
          style={{ color: textColor }}
          aria-hidden="true"
        >
          {/* Marca de límite (P2 — Tramo 2): glyph/badge junto al monto (ring va en el contorno de la barra) */}
          {mark?.effect === "glyph" && <LimitGlyph tooltip={describeLimitMark(mark)} size={11} />}
          {mark?.effect === "badge" && <LimitBadge tooltip={describeLimitMark(mark)} />}

          {/* Monto — pieza primaria: mono 12px/700, shrink-0 */}
          <span
            className="mono text-[12px] font-bold shrink-0 tabular-nums"
            data-testid="bar-amount"
          >
            {amountFmt}
          </span>

          {/* Separador + nombre — solo en barra ancha (escalón 1) */}
          {isWide && descText && (
            <>
              {/* Punto medio · separador */}
              <span
                className="shrink-0 text-[12px] select-none"
                style={{ opacity: 0.45 }}
                aria-hidden="true"
              >
                ·
              </span>
              {/* Nombre secundario: UI 11.5px/500, atenuado (opacity 0.72) */}
              <span
                className="text-[11.5px] font-medium truncate"
                style={{ opacity: 0.72 }}
              >
                {descText}
              </span>
            </>
          )}
        </span>
      )}

      {/* Spacer para empujar el chevron › al borde derecho */}
      {!bar.continuesAfter && <span className="flex-1" aria-hidden="true" />}

      {/* Chevron › si continúa después */}
      {bar.continuesAfter && (
        <span
          aria-hidden="true"
          className="shrink-0 ml-auto pr-[4px] pointer-events-none"
          style={{ color: textColor }}
        >
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

// ─── Etiqueta exterior de barra angosta ───────────────────────────────────────
// Escalón 3: ni el monto cabe dentro de la barra → solo el monto afuera.
// El nombre NUNCA viaja afuera (solo el monto).

interface OuterLabelProps {
  bar: CuotasGanttBar;
  currency: string;
  visualRowIndex: number;
  /** Marca de límite (P2 — Tramo 2): reporte.cuotas.montoPorCuota / .cantidadCuotas. */
  mark: EvaluatedLimitMark | null;
}

function OuterLabel({ bar, currency, visualRowIndex, mark }: OuterLabelProps) {
  const spanCols = bar.endMonthIndex - bar.startMonthIndex + 1;
  const barTop = visualRowIndex * (ROW_HEIGHT + ROW_GAP) + Math.floor((ROW_HEIGHT - BAR_HEIGHT) / 2);
  const rightEdgePct = ((bar.startMonthIndex + spanCols) / 12) * 100;

  // Si la barra termina en diciembre (o no hay aire a la derecha), el monto va a la izquierda.
  const endsAtEdge = bar.endMonthIndex === 11;
  const leftEdgePct = (bar.startMonthIndex / 12) * 100;

  const amountFmt = formatCurrency(bar.amountCents, currency);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex items-center"
      style={{
        top: barTop,
        height: BAR_HEIGHT,
        // A la derecha con ml-[6px], a la izquierda desplazado con translateX(-100%) + mr-[6px]
        left: endsAtEdge ? `${leftEdgePct}%` : `${rightEdgePct}%`,
        paddingLeft: endsAtEdge ? 0 : 6,
        transform: endsAtEdge ? "translateX(-100%)" : undefined,
        paddingRight: endsAtEdge ? 6 : 0,
      }}
    >
      {/* Marca de límite (P2 — Tramo 2): glyph/badge junto al monto exterior */}
      {mark?.effect === "glyph" && <LimitGlyph tooltip={describeLimitMark(mark)} size={11} />}
      {mark?.effect === "badge" && <LimitBadge tooltip={describeLimitMark(mark)} />}

      {/* Solo el monto — el nombre NUNCA viaja afuera (spec §4 escalón 3) */}
      <span
        className="mono text-[12px] font-bold text-ink shrink-0 tabular-nums"
        data-testid="outer-amount"
      >
        {amountFmt}
      </span>
    </div>
  );
}

// ─── Canvas del gantt ─────────────────────────────────────────────────────────

interface GanttCanvasProps {
  data: CuotasGanttResponse;
  year: number;
  currency: string;
  isEmpty: boolean;
  isDark: boolean;
  /** Límites del usuario (P2 — Tramo 2). [] = cero impacto (D9). */
  limits: LimitConfig[];
}

function GanttCanvas({ data, year, currency, isEmpty, isDark, limits }: GanttCanvasProps) {
  const [tooltipState, setTooltipState] = useState<BarTooltipState | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Affordance de corte del carril horizontal (docs/design.md §"Superficies
  // con scroll interno" → "Affordance de 'hay más'"). box-shadow, no mask
  // (taparía las cifras mono de las barras).
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollShadow = useScrollShadow(scrollRef);

  /** Mapa categoryId → { name, color } para resolución rápida. */
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const cat of data.availableCategories) {
      map.set(cat.categoryId, { name: cat.name, color: cat.color });
    }
    return map;
  }, [data.availableCategories]);

  const handleBarMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, bar: CuotasGanttBar, color: string, name: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipState({
        bar,
        categoryColor: color,
        categoryName: name,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        mark: computeInstallmentBarMark(limits, bar),
      });
    },
    [limits],
  );

  const handleBarMouseLeave = useCallback(() => {
    setTooltipState(null);
  }, []);

  const rowCount = data.rowCount;
  // Alto total del área de plot
  const plotHeight = rowCount > 0
    ? rowCount * ROW_HEIGHT + (rowCount - 1) * ROW_GAP
    : ROW_HEIGHT; // mínimo aunque esté vacío

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        boxShadow: getScrollShadowStyle(scrollShadow, isDark),
      }}
    >
      {/* Header de meses — sticky arriba */}
      <div
        role="rowgroup"
        aria-label="Meses del año"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          minWidth: "calc(12 * 64px)",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {MONTH_LABELS_SHORT.map((label, i) => (
          <div
            key={i}
            className="text-[12px] font-semibold text-muted text-center py-[6px]"
            style={{
              borderRight: i < 11 ? "1px solid var(--hair)" : undefined,
              minWidth: 64,
            }}
            role="columnheader"
            aria-label={MONTH_LABELS_LONG[i]}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Área de plot — barras posicionadas absolutas sobre grilla */}
      <div
        role="table"
        aria-label={`Gastos en cuotas ${year}`}
        style={{
          position: "relative",
          minWidth: "calc(12 * 64px)",
          height: plotHeight,
          overflow: "hidden",
          marginTop: 4,
        }}
      >
        {/* Gridlines verticales de fondo */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                borderRight: i < 11 ? "1px solid var(--hair)" : undefined,
                height: "100%",
              }}
            />
          ))}
        </div>

        {/* Overlay vacío */}
        {isEmpty && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            aria-live="polite"
          >
            <p className="text-[14px] text-muted bg-panel/80 px-3 py-2 rounded-ctl">
              Sin gastos en cuotas en {year}.
            </p>
          </div>
        )}

        {/* Barras: invertir eje — backend rowIndex=0 es abajo, nosotros lo ponemos en fila visual (rowCount-1) */}
        {data.bars.map((bar) => {
          const cat = categoryMap.get(bar.categoryId);
          const color = cat?.color ?? "#999999";
          const name = cat?.name ?? "Sin categoría";
          // Inversión: rowIndex=0 (backend, pegado al eje) → visualRowIndex = rowCount-1 (abajo visualmente)
          const visualRowIndex = rowCount - 1 - bar.rowIndex;
          const spanCols = bar.endMonthIndex - bar.startMonthIndex + 1;

          /**
           * Escalón 3: ni el monto cabe dentro.
           * Ocurre cuando la barra tiene solo 1 columna Y tiene chevrones en ambos extremos
           * (los dos chevrones consumen el espacio disponible, sin aire para el monto).
           * En ese caso la barra queda como pastilla de color y el monto va afuera.
           */
          const labelOutside = spanCols === 1 && bar.continuesBefore && bar.continuesAfter;
          // P2 — Tramo 2: reporte.cuotas.montoPorCuota / .cantidadCuotas (bar).
          const mark = computeInstallmentBarMark(limits, bar);

          return (
            <div key={bar.id}>
              <GanttBar
                bar={bar}
                categoryColor={color}
                categoryName={name}
                currency={currency}
                visualRowIndex={visualRowIndex}
                labelOutside={labelOutside}
                mark={mark}
                onMouseEnter={handleBarMouseEnter}
                onMouseLeave={handleBarMouseLeave}
              />
              {/* Etiqueta exterior — solo escalón 3 (ni el monto cabe dentro).
                  El nombre NUNCA viaja afuera; solo el monto. */}
              {labelOutside && (
                <OuterLabel
                  bar={bar}
                  currency={currency}
                  visualRowIndex={visualRowIndex}
                  mark={mark}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip portaled */}
      {mounted && tooltipState && createPortal(
        <BarTooltipPortal
          tooltipState={tooltipState}
          currency={currency}
        />,
        document.body,
      )}
    </div>
  );
}

// ─── CuotasGanttCard — Props ──────────────────────────────────────────────────

export interface CuotasGanttCardProps {
  year: number;
  categoryIds?: string[] | null;
  currency?: CurrencyCode;
  title?: string;
  titlePlaceholder?: string;
  removable?: boolean;
  onYearChange?: (year: number) => void;
  onCategoryIdsChange?: (ids: string[] | null) => void;
  onCurrencyChange?: (c: CurrencyCode) => void;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
}

// ─── CuotasGanttCard ─────────────────────────────────────────────────────────

/**
 * Card de reporte de gantt anual de gastos en Cuotas (Ola 3, P2).
 *
 * Encapsula:
 * - Cabecera: título editable + YearStepper + CardCurrencySelect + X
 * - Canvas: gantt de barras horizontales sobre grilla de 12 meses (CSS nativo)
 * - Filtro: chips-toggle de categoría (ChartLegend) debajo del plot
 */
export function CuotasGanttCard({
  year,
  categoryIds = null,
  currency,
  title: titleProp,
  titlePlaceholder = "Reporte",
  removable = false,
  onYearChange,
  onCategoryIdsChange,
  onCurrencyChange,
  onRemove,
  onTitleChange,
}: CuotasGanttCardProps) {
  const { defaultCurrency } = useSettings();
  const effectiveCurrency = currency ?? defaultCurrency;
  const isDark = useIsDarkMode();
  // P2 — Fase 1 (Tramo 2): límites del usuario (marca visual pasiva). [] = cero impacto (D9).
  const { limits } = useLimits();

  const { data, isLoading, isError, isFetching, refetch } = useCuotasGantt(year, categoryIds, currency);

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Estado de edición del título ───────────────────────────────────────────
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

  // ── Año actual ─────────────────────────────────────────────────────────────
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  useEffect(() => { setCurrentYear(new Date().getFullYear()); }, []);

  function handlePrev() { onYearChange?.(year - 1); }
  function handleNext() { if (year < currentYear) onYearChange?.(year + 1); }

  // ── Lógica de categorías ───────────────────────────────────────────────────
  const availableCategories = useMemo(
    () => data?.availableCategories ?? [],
    [data?.availableCategories],
  );

  const handleCategoryLegendToggle = useCallback(
    (categoryId: string) => {
      if (availableCategories.length === 0) return;
      const allIds = availableCategories.map((c) => c.categoryId);
      const currentActive: string[] = categoryIds === null ? allIds : categoryIds;
      const isCurrentlyActive = currentActive.includes(categoryId);
      let newIds: string[] | null;
      if (isCurrentlyActive) {
        const remaining = currentActive.filter((id) => id !== categoryId);
        newIds = remaining.length === allIds.length ? null : remaining;
      } else {
        const added = [...currentActive, categoryId];
        newIds = added.length === allIds.length ? null : added;
      }
      onCategoryIdsChange?.(newIds);
    },
    [availableCategories, categoryIds, onCategoryIdsChange],
  );

  const hiddenCategoryIds: string[] = (() => {
    if (categoryIds === null) return [];
    const activeSet = new Set(categoryIds);
    return availableCategories.filter((c) => !activeSet.has(c.categoryId)).map((c) => c.categoryId);
  })();

  const legendItems = availableCategories.map((cat) => ({
    id: cat.categoryId,
    color: cat.color,
    label: cat.name,
  }));

  // ── ¿Está vacío? (sin barras) ─────────────────────────────────────────────
  const isEmpty = data ? data.bars.length === 0 : false;

  const displayTitle = titleProp ?? titlePlaceholder;

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${displayTitle} ${year}`}
    >
      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        <div className="flex min-w-0 flex-1 items-center gap-[6px]">
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
          {/* Popover informativo de límites (P2) — esta card nunca vive en Dashboard */}
          <LimitsInfoPopover surface="reporte-installment-gantt" />
        </div>

        {/* Controles derecha: stepper + moneda + X */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <YearStepper
            year={year}
            currentYear={currentYear}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          {onCurrencyChange && (
            <>
              <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
              <CardCurrencySelect value={effectiveCurrency} onChange={onCurrencyChange} />
            </>
          )}

          <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualizar reporte"
            aria-busy={isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={cn(isFetching && "animate-spin motion-reduce:animate-none")}
            />
          </button>
          {removable && (
            <button
              ref={removeButtonRef}
              type="button"
              onClick={() => setRemoveOpen((o) => !o)}
              aria-label="Quitar reporte"
              className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Área de contenido ── */}
      {isError ? (
        <GanttError onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <GanttSkeleton />
      ) : (
        <>
          {/* Canvas del gantt */}
          <GanttCanvas
            data={data}
            year={year}
            currency={effectiveCurrency}
            isEmpty={isEmpty}
            isDark={isDark}
            limits={limits}
          />

          {/* Filtro de categorías */}
          {availableCategories.length > 0 && (
            <ChartLegend
              items={legendItems}
              hiddenIds={hiddenCategoryIds}
              onToggle={handleCategoryLegendToggle}
              groupLabel="Filtrar categorías"
              scrollable
              commandSlot={
                <LegendAllChip
                  hiddenCategoryIds={hiddenCategoryIds}
                  onCategoryIdsChange={onCategoryIdsChange}
                />
              }
            />
          )}
        </>
      )}

      {/* Popover de confirmación quitar */}
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
