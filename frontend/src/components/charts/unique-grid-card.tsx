"use client";

/**
 * UniqueGridCard — Card de reporte de grilla día × mes para Únicos (Ola 3, P2).
 *
 * Implementa el canvas de heatmap calendario de gastos únicos:
 * - Tabla semántica (<table>) con CSS Grid: header de meses (sticky) + cuerpo
 *   de 31 filas de día + footer de 5 métricas por mes.
 * - Rampa de color oklch verde→ámbar→rojo (0 → ancla en centavos del backend).
 * - Filtro de categorías: fila de chips-toggle debajo del footer (ChartLegend).
 * - Misma cabecera que las otras cards (título editable P4 + YearStepper +
 *   CardCurrencySelect + X).
 *
 * Spec visual: docs/design.md §"Reporte anual de Únicos — grilla día × mes (Ola 3, P2)".
 *
 * Gotchas:
 * - La grilla del backend SIEMPRE viene 31×12; los días inexistentes (feb 30,
 *   abr 31, etc.) llegan como 0 pero se distinguen por calendario (no por valor).
 * - El ancla de color (`colorAnchorCents`) viene del backend ya reconvertida a la
 *   moneda de display; el front la usa tal cual para t = clamp(total/ancla, 0, 1).
 * - El parámetro `today` DEBE mandarse con la fecha local para que el backend
 *   compute correctamente el promedio diario del mes en curso.
 * - La rampa tiene dos conjuntos de stops (claro/oscuro) — el front interpola
 *   sobre la rampa correcta según el modo de color activo.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useUnicoGrid } from "@/hooks/use-reports";
import { useSettings } from "@/hooks/use-settings";
import { formatCurrency, CURRENCY_SYMBOLS } from "@/lib/format";
import { ChartLegend } from "@/components/ui/chart";
import { CardCurrencySelect } from "@/components/ui/card-currency-select";
import type { UnicoGridResponse } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";
import { Eye, EyeOff, Pencil } from "lucide-react";

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Días en cada mes para años no bisiestos / bisiestos. Index 0=ene. */
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Rampa de color oklch ──────────────────────────────────────────────────────

/**
 * 4 stops de la rampa, en claro y oscuro.
 * Cada stop: [L, C, H] en oklch.
 */
const RAMP_STOPS_LIGHT: [number, number, number][] = [
  [0.94, 0.05, 150], // t=0 verde muy claro
  [0.90, 0.10, 110], // t=0.33 verde-lima
  [0.88, 0.13, 70],  // t=0.66 ámbar
  [0.78, 0.16, 30],  // t=1 rojo-coral
];

const RAMP_STOPS_DARK: [number, number, number][] = [
  [0.32, 0.05, 150],
  [0.36, 0.09, 110],
  [0.40, 0.12, 70],
  [0.45, 0.15, 30],
];

/**
 * Interpola un valor entre dos escalares.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpola el color de heatmap para un valor dado de t ∈ [0,1].
 * Interpola entre los 4 stops (3 segmentos).
 */
function interpolateRamp(t: number, isDark: boolean): string {
  const stops = isDark ? RAMP_STOPS_DARK : RAMP_STOPS_LIGHT;
  const clamped = Math.max(0, Math.min(1, t));

  // 4 stops → 3 segmentos de igual longitud (0–0.33, 0.33–0.66, 0.66–1)
  const segCount = stops.length - 1; // 3
  const segIdx = Math.min(Math.floor(clamped * segCount), segCount - 1);
  const segT = clamped * segCount - segIdx;

  const [L1, C1, H1] = stops[segIdx]!;
  const [L2, C2, H2] = stops[segIdx + 1]!;

  const L = lerp(L1, L2, segT);
  const C = lerp(C1, C2, segT);
  const H = lerp(H1, H2, segT);

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/**
 * Calcula t para un total en centavos respecto al ancla entregada por el backend.
 * @param totalCents - total del día en centavos de la moneda de display
 * @param anchorCents - ancla de la rampa en centavos (colorAnchorCents del response)
 */
function calcT(totalCents: number, anchorCents: number): number {
  if (anchorCents <= 0) return 0;
  return Math.max(0, Math.min(1, totalCents / anchorCents));
}

/**
 * Devuelve el color de texto (oscuro o claro) para garantizar contraste
 * contra el tinte de celda.
 * Tintes claros (L alto) → texto oscuro; tintes oscuros → texto claro.
 */
function getCellTextColor(isDark: boolean): string {
  if (isDark) {
    // stops oscuros: L entre 0.32 y 0.45 — todos necesitan texto claro
    return "oklch(0.94 0.005 270)";
  }
  // stops claros: L entre 0.78 y 0.94 — todos necesitan texto oscuro
  return "oklch(0.25 0.02 270)";
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

// ─── Hook: dark mode ──────────────────────────────────────────────────────────

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    // El modo oscuro se controla con data-theme="dark" en el elemento raíz
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

// ─── Helper: abreviación de monto ────────────────────────────────────────────

/**
 * Formatea centavos de forma abreviada para celdas y footer angostos.
 * $0 / $8 / $13 / $1,2k / $1,5M
 */
function formatCurrencyAbbr(cents: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  const pesos = cents / 100;
  if (pesos === 0) return `${sym}0`;
  if (pesos >= 1_000_000) {
    const m = pesos / 1_000_000;
    return `${sym}${m % 1 === 0 ? String(m) : m.toFixed(1).replace(".", ",")}M`;
  }
  if (pesos >= 1_000) {
    const k = pesos / 1_000;
    return `${sym}${k % 1 === 0 ? String(k) : k.toFixed(1).replace(".", ",")}k`;
  }
  return `${sym}${pesos % 1 === 0 ? String(pesos) : pesos.toFixed(2).replace(".", ",")}`;
}

/**
 * Formatea un %dif (ya en puntos porcentuales, ej. 12.40).
 * Retorna el string con 2 decimales es-AR.
 */
function formatPct(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div role="status" aria-label="Cargando reporte">
      <SkeletonBlock height={600} radius="ctl" />
      <div className="mt-[10px] h-[36px] rounded-ctl bg-panel-3 animate-shimmer" aria-hidden="true" />
      <div className="mt-[14px] flex gap-4">
        {[70, 56, 80].map((w, i) => (
          <SkeletonLine key={i} height={14} width={w} />
        ))}
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

function GridError({ onRetry }: { onRetry: () => void }) {
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
  earliestYear: number | null;
  onPrev: () => void;
  onNext: () => void;
}

function YearStepper({ year, currentYear, earliestYear, onPrev, onNext }: YearStepperProps) {
  // Cuando earliestYear es null (desconocido), permitir navegación libre hacia atrás
  const canGoPrev = earliestYear === null ? true : year > earliestYear;
  const canGoNext = year < currentYear;

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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

/**
 * Estado del tooltip de celda: qué celda está activa.
 */
interface CellTooltipState {
  day: number;
  monthIdx: number;
  totalCents: number;
  /** Desglose por categoría de este día (ya ordenado DESC por amount del back). */
  breakdown: Array<{ categoryId: string; amount: number }>;
  x: number;
  y: number;
}

/**
 * Estado del tooltip de footer: qué mes está activo.
 */
interface FooterTooltipState {
  monthIdx: number;
  footer: UnicoGridResponse["footer"][0];
  x: number;
  y: number;
}

/** Nombres largos de meses es-AR para el encabezado del tooltip de footer. */
const MONTH_LABELS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Footer de métricas por mes ────────────────────────────────────────────────

interface FooterCellProps {
  monthIdx: number;
  footer: UnicoGridResponse["footer"][0];
  currency: string;
  onMouseEnter: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseLeave: () => void;
}

function PctDifDisplay({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <div className="flex flex-col gap-[1px]">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">{label}</span>
        <span className="mono text-[10.5px] font-semibold text-muted">—</span>
      </div>
    );
  }

  const isUp = value > 0;
  const Arrow = isUp ? ArrowUp : ArrowDown;

  return (
    <div className="flex flex-col gap-[1px]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">{label}</span>
      <span className="mono text-[10.5px] font-semibold text-ink-2 flex items-center gap-[2px]">
        {value !== 0 && (
          <Arrow size={9} strokeWidth={2.5} aria-hidden="true" className="text-ink-2 shrink-0" />
        )}
        {formatPct(value)}%
      </span>
    </div>
  );
}

/**
 * Fila de métrica label ⟷ valor para el tooltip rico del footer (§4b).
 */
function TooltipMetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[16px]">
      <span className="flex-1 truncate text-[11.5px] font-medium text-ink-2">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  );
}

function FooterCell({ footer, currency, onMouseEnter, onMouseLeave }: FooterCellProps) {
  const totalAbbr = formatCurrencyAbbr(footer.total, currency);
  const avgAbbr = footer.dailyAvg !== null ? formatCurrencyAbbr(footer.dailyAvg, currency) : null;
  const inflFmt = footer.inflationPct !== null ? `${formatPct(footer.inflationPct)}pts` : null;

  return (
    <td
      className="align-top px-[4px] pt-[8px] pb-[6px] bg-panel-2 border-t border-line cursor-default"
      style={{ minWidth: 0 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 1. Total (cifra dominante) */}
      <div className="mono text-[12px] font-semibold text-ink leading-none mb-[5px]">
        {totalAbbr}
      </div>

      {/* 2. Promedio diario */}
      {avgAbbr !== null ? (
        <div className="flex flex-col gap-[1px] mb-[4px]">
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">prom</span>
          <span className="mono text-[10.5px] font-medium text-ink-2">{avgAbbr}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-[1px] mb-[4px]">
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">prom</span>
          <span className="mono text-[10.5px] font-medium text-muted">—</span>
        </div>
      )}

      {/* 3. %dif vs anterior */}
      <div className="mb-[4px]">
        <PctDifDisplay value={footer.pctVsPrev} label="vs ant" />
      </div>

      {/* 4. Inflación */}
      <div className="mb-[4px]">
        {footer.inflationPct !== null ? (
          <div className="flex flex-col gap-[1px]">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">infl</span>
            <span className="mono text-[10.5px] font-medium text-ink-2">{inflFmt}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-[1px]">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-faint leading-none">infl</span>
            <span className="mono text-[10.5px] font-medium text-muted">—</span>
          </div>
        )}
      </div>

      {/* 5. %dif ajustado por inflación */}
      <PctDifDisplay value={footer.pctVsPrevAdj} label="real" />
    </td>
  );
}

// ─── Tabla de la grilla ────────────────────────────────────────────────────────

interface GridTableProps {
  data: UnicoGridResponse;
  year: number;
  currency: string;
  isDark: boolean;
  isEmpty: boolean;
  colorAnchorCents: number;
}

function GridTable({ data, year, currency, isDark, isEmpty, colorAnchorCents }: GridTableProps) {
  const [cellTooltip, setCellTooltip] = useState<CellTooltipState | null>(null);
  const [footerTooltip, setFooterTooltip] = useState<FooterTooltipState | null>(null);

  /** Mapa de categoryId → { name, color } para resolución rápida. */
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const cat of data.availableCategories) {
      map.set(cat.categoryId, { name: cat.name, color: cat.color });
    }
    return map;
  }, [data.availableCategories]);

  function handleCellMouseEnter(
    e: React.MouseEvent<HTMLTableCellElement>,
    day: number,
    monthIdx: number,
    totalCents: number,
    dayIdx: number,
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    const breakdown = data.breakdown?.[dayIdx]?.[monthIdx] ?? [];
    setCellTooltip({
      day,
      monthIdx,
      totalCents,
      breakdown,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  function handleCellMouseLeave() {
    setCellTooltip(null);
  }

  function handleFooterMouseEnter(
    e: React.MouseEvent<HTMLTableCellElement>,
    monthIdx: number,
    footer: UnicoGridResponse["footer"][0],
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    setFooterTooltip({
      monthIdx,
      footer,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  function handleFooterMouseLeave() {
    setFooterTooltip(null);
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="relative overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* Overlay vacío */}
      {isEmpty && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          aria-live="polite"
        >
          <p className="text-[14px] text-muted bg-panel/80 px-3 py-2 rounded-ctl">
            Sin gastos únicos en {year}.
          </p>
        </div>
      )}

      <table
        className="w-full border-collapse text-left"
        role="table"
        aria-label={`Gastos únicos ${year}`}
        style={{ tableLayout: "fixed" }}
      >
        {/* ── Header de meses ── */}
        <thead>
          <tr>
            {/* Celda esquina vacía */}
            <th
              scope="col"
              className="sticky left-0 top-0 z-20 bg-panel border-b border-line border-r border-hair"
              style={{ width: 28 }}
              aria-label="Día / Mes"
            />
            {MONTH_LABELS_SHORT.map((label, i) => (
              <th
                key={i}
                scope="col"
                className="sticky top-0 z-10 bg-panel border-b border-line text-[12px] font-semibold text-muted text-center py-[4px] px-0"
                style={{ minWidth: 64 }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Cuerpo: 31 filas de día ── */}
        <tbody>
          {Array.from({ length: 31 }, (_, dayIdx) => {
            const day = dayIdx + 1;
            return (
              <tr key={day}>
                {/* Columna fija de número de día */}
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-panel border-r border-hair text-right pr-[6px] text-muted select-none"
                  style={{ width: 28, height: 19 }}
                >
                  <span className="mono text-[11px]">{day}</span>
                </th>

                {/* 12 celdas de mes */}
                {Array.from({ length: 12 }, (_, monthIdx) => {
                  const daysInMonth = getDaysInMonth(monthIdx, year);
                  const isNull = day > daysInMonth;

                  if (isNull) {
                    // Celda nula: día inexistente en este mes — no conectar tooltip (§8)
                    return (
                      <td
                        key={monthIdx}
                        aria-hidden="true"
                        className="p-0"
                        style={{
                          height: 19,
                          background: "var(--panel-2)",
                          outline: "2px solid var(--panel)",
                        }}
                      />
                    );
                  }

                  const totalCents = data.grid[dayIdx]?.[monthIdx] ?? 0;
                  const t = calcT(totalCents, colorAnchorCents);
                  const bg = interpolateRamp(t, isDark);
                  const textColor = getCellTextColor(isDark);
                  const fmtCents = formatCurrencyAbbr(totalCents, currency);
                  const fmtFull = formatCurrency(totalCents, currency);
                  const dayLabel = `Día ${day}, ${MONTH_LABELS_SHORT[monthIdx]} ${year}: ${fmtFull}`;

                  return (
                    <td
                      key={monthIdx}
                      aria-label={dayLabel}
                      className="p-0 cursor-default transition-opacity duration-[80ms] hover:opacity-80"
                      style={{
                        height: 19,
                        background: bg,
                        outline: "2px solid var(--panel)",
                        color: textColor,
                      }}
                      onMouseEnter={(e) => handleCellMouseEnter(e, day, monthIdx, totalCents, dayIdx)}
                      onMouseLeave={handleCellMouseLeave}
                    >
                      {/* Cifra abreviada — mono 10.5px */}
                      <div
                        className="mono text-[10.5px] text-center leading-none w-full overflow-hidden text-ellipsis whitespace-nowrap px-[2px]"
                        style={{ color: textColor }}
                      >
                        {fmtCents}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

        {/* ── Footer de métricas ── */}
        <tfoot>
          <tr>
            {/* Celda esquina vacía del footer */}
            <td className="sticky left-0 z-10 bg-panel-2 border-t border-line border-r border-hair" style={{ width: 28 }} aria-hidden="true" />
            {data.footer.map((footerMonth, monthIdx) => (
              <FooterCell
                key={monthIdx}
                monthIdx={monthIdx}
                footer={footerMonth}
                currency={currency}
                onMouseEnter={(e) => handleFooterMouseEnter(e, monthIdx, footerMonth)}
                onMouseLeave={handleFooterMouseLeave}
              />
            ))}
          </tr>
        </tfoot>
      </table>

      {/* ── Tooltip de celda con desglose (portaled a body) — §8 ── */}
      {mounted && cellTooltip && createPortal(
        <div
          className="fixed z-50 rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] px-3 py-[10px] pointer-events-none"
          style={{
            left: cellTooltip.x,
            top: cellTooltip.y,
            transform: "translate(-50%, -100%)",
            minWidth: 180,
          }}
          role="tooltip"
        >
          {/* Encabezado: fecha */}
          <div className="text-[12px] font-semibold text-ink-2 mb-[2px]">
            {MONTH_LABELS_SHORT[cellTooltip.monthIdx]} {cellTooltip.day}, {year}
          </div>
          {/* Total del día — cifra dominante */}
          <div className={cn(
            "mono text-[13px] font-semibold mb-[6px]",
            cellTooltip.totalCents === 0 ? "text-muted" : "text-ink",
          )}>
            {formatCurrency(cellTooltip.totalCents, currency)}
          </div>

          {/* Divisor solo si hay breakdown */}
          {cellTooltip.breakdown.length > 0 && (
            <div
              aria-hidden="true"
              style={{ borderTop: "1px solid var(--hair)", marginBottom: 6 }}
            />
          )}

          {/* Filas de desglose por categoría — scroll si >8 filas */}
          {cellTooltip.breakdown.length > 0 ? (
            <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
              <div className="flex flex-col gap-[5px]">
                {cellTooltip.breakdown.map(({ categoryId, amount }) => {
                  const cat = categoryMap.get(categoryId);
                  if (!cat) return null;
                  return (
                    <div key={categoryId} className="flex items-center gap-[7px]">
                      {/* Swatch de color de categoría */}
                      <div
                        aria-hidden="true"
                        className="shrink-0 rounded-[3px]"
                        style={{ width: 8, height: 8, background: cat.color }}
                      />
                      {/* Nombre */}
                      <span className="flex-1 truncate text-[12.5px] font-medium text-ink-2">
                        {cat.name}
                      </span>
                      {/* Monto completo sin abreviar */}
                      <span className="mono text-[12.5px] font-medium text-ink-2 shrink-0">
                        {formatCurrency(amount, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Día con $0: sin filas de desglose → micro-línea "Sin gastos" */
            cellTooltip.totalCents === 0 && (
              <div className="text-[12px] text-muted">Sin gastos</div>
            )
          )}
        </div>,
        document.body,
      )}

      {/* ── Tooltip rico del footer (portaled a body) — §4b ── */}
      {mounted && footerTooltip && createPortal(
        <FooterTooltipPortal
          footerTooltip={footerTooltip}
          currency={currency}
          year={year}
        />,
        document.body,
      )}
    </div>
  );
}

/**
 * Tooltip rico del footer (§4b).
 * Componente separado para mantener `GridTable` legible.
 */
function FooterTooltipPortal({
  footerTooltip,
  currency,
  year,
}: {
  footerTooltip: FooterTooltipState;
  currency: string;
  year: number;
}) {
  const { footer, monthIdx, x, y } = footerTooltip;
  const monthNameLong = MONTH_LABELS_LONG[monthIdx] ?? "";
  const totalFmt = formatCurrency(footer.total, currency);
  const avgFull = footer.dailyAvg !== null ? formatCurrency(footer.dailyAvg, currency) : null;

  return (
    <div
      className="fixed z-50 rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] px-[10px] py-[8px] pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        minWidth: 190,
      }}
      role="tooltip"
    >
      {/* Encabezado: nombre largo del mes + año */}
      <div className="text-[12px] font-semibold text-ink-2 mb-[6px]">
        {monthNameLong} {year}
      </div>

      {/* 5 filas label ⟷ valor */}
      <div className="flex flex-col gap-[5px]">
        {/* 1. Total */}
        <TooltipMetricRow label="Total">
          <span className="mono text-[12px] font-semibold text-ink">{totalFmt}</span>
        </TooltipMetricRow>

        {/* Separador opcional entre el total y las métricas derivadas */}
        <div aria-hidden="true" style={{ borderTop: "1px solid var(--hair)", margin: "3px 0" }} />

        {/* 2. Promedio diario */}
        <TooltipMetricRow label="Promedio diario">
          {avgFull !== null ? (
            <span className="mono text-[11px] font-medium text-ink-2">{avgFull}</span>
          ) : (
            <span className="mono text-[11px] font-medium text-muted">—</span>
          )}
        </TooltipMetricRow>

        {/* 3. %dif vs mes anterior */}
        <TooltipMetricRow label="vs. mes anterior">
          {footer.pctVsPrev !== null ? (
            <span className="mono text-[11px] font-semibold text-ink-2 flex items-center gap-[2px]">
              {footer.pctVsPrev !== 0 && (
                footer.pctVsPrev > 0
                  ? <ArrowUp size={9} strokeWidth={2.5} aria-hidden="true" className="text-ink-2 shrink-0" />
                  : <ArrowDown size={9} strokeWidth={2.5} aria-hidden="true" className="text-ink-2 shrink-0" />
              )}
              {formatPct(footer.pctVsPrev)}%
            </span>
          ) : (
            <span className="mono text-[11px] font-medium text-muted">—</span>
          )}
        </TooltipMetricRow>

        {/* 4. Inflación */}
        <TooltipMetricRow label="Inflación">
          {footer.inflationPct !== null ? (
            <span className="mono text-[11px] font-medium text-ink-2">
              {formatPct(footer.inflationPct)}pts
            </span>
          ) : (
            <span className="mono text-[11px] font-medium text-muted">—</span>
          )}
        </TooltipMetricRow>

        {/* 5. %dif ajustado por inflación */}
        <TooltipMetricRow label="vs. anterior (real)">
          {footer.pctVsPrevAdj !== null ? (
            <span className="mono text-[11px] font-semibold text-ink-2 flex items-center gap-[2px]">
              {footer.pctVsPrevAdj !== 0 && (
                footer.pctVsPrevAdj > 0
                  ? <ArrowUp size={9} strokeWidth={2.5} aria-hidden="true" className="text-ink-2 shrink-0" />
                  : <ArrowDown size={9} strokeWidth={2.5} aria-hidden="true" className="text-ink-2 shrink-0" />
              )}
              {formatPct(footer.pctVsPrevAdj)}%
            </span>
          ) : (
            <span className="mono text-[11px] font-medium text-muted">—</span>
          )}
        </TooltipMetricRow>
      </div>
    </div>
  );
}

// ─── UniqueGridCard — Props ───────────────────────────────────────────────────

export interface UniqueGridCardProps {
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

// ─── UniqueGridCard ───────────────────────────────────────────────────────────

/**
 * Card de reporte de grilla día × mes de gastos Únicos (Ola 3, P2).
 *
 * Encapsula:
 * - Cabecera: título editable + YearStepper + CardCurrencySelect + X
 * - Canvas: tabla semántica con heatmap calendario
 * - Filtro: chips-toggle de categoría (ChartLegend) debajo del footer
 */
export function UniqueGridCard({
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
}: UniqueGridCardProps) {
  const { defaultCurrency } = useSettings();
  const effectiveCurrency = currency ?? defaultCurrency;
  const isDark = useIsDarkMode();
  useReducedMotion(); // side-effect: noop aquí pero mantenemos el patrón

  // Calcular `today` en formato YYYY-MM-DD en la zona del navegador
  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const { data, isLoading, isError, refetch } = useUnicoGrid(year, categoryIds, currency, today);

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

  // ── earliestYear (se infiere del primer año disponible vía useReports) ─────
  // El contrato de UnicoGridResponse no devuelve earliestYear; usamos la heurística
  // de que si el año pedido < año actual y la grilla está vacía (todos 0), no navegar más atrás.
  // Para la navegación, bloqueamos ‹ cuando no haya datos y year < currentYear.
  // Alternativa: el orquestador puede inyectar earliestYear como prop en el futuro.
  // Por ahora, sin earliestYear definido, ‹ siempre habilitado (salvo year === currentYear - N límite).
  // DECISIÓN: sin earliestYear en el contrato de annual-unicos; navegación libre hacia atrás.
  const earliestYear: number | null = null;

  function handlePrev() {
    // Cuando earliestYear es null, navegación libre hacia atrás
    const canGoPrev = earliestYear === null ? true : year > earliestYear;
    if (canGoPrev) onYearChange?.(year - 1);
  }
  function handleNext() {
    if (year < currentYear) onYearChange?.(year + 1);
  }

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

  // ── ¿Está vacío? (todos los totales en 0) ─────────────────────────────────
  const isEmpty = data
    ? data.footer.every((f) => f.total === 0)
    : false;

  const displayTitle = titleProp ?? titlePlaceholder;

  return (
    <div
      className="bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] p-[var(--card-pad)] animate-screen-fade"
      aria-label={`${displayTitle} ${year}`}
    >
      {/* ── Cabecera: una sola fila justify-between (mismo patrón que by-category) ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]">
        <div className="min-w-0 flex-1">
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

        {/* Controles derecha: stepper + moneda + X */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <YearStepper
            year={year}
            currentYear={currentYear}
            earliestYear={earliestYear}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          {onCurrencyChange && (
            <>
              <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
              <CardCurrencySelect value={effectiveCurrency} onChange={onCurrencyChange} />
            </>
          )}

          {removable && (
            <>
              <span className="block h-[16px] w-px bg-hair shrink-0" aria-hidden="true" />
              <button
                ref={removeButtonRef}
                type="button"
                onClick={() => setRemoveOpen((o) => !o)}
                aria-label="Quitar reporte"
                className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Área de contenido ── */}
      {isError ? (
        <GridError onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <GridSkeleton />
      ) : (
        <>
          {/* Tabla de la grilla */}
          <GridTable
            data={data}
            year={year}
            currency={effectiveCurrency}
            isDark={isDark}
            isEmpty={isEmpty}
            colorAnchorCents={data.colorAnchorCents}
          />

          {/* Filtro de categorías (chips-toggle debajo del footer) */}
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
