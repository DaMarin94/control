"use client";

/**
 * MonthJumpPopover — Selector de salto de mes/año tipo "rueda" para /mes (Ola 1, P4).
 *
 * Permite saltar rápidamente a cualquier mes/año sin reemplazar la navegación
 * secuencial (flechas desktop / pill stepper mobile).
 *
 * Comportamiento de cierre (regla dura P6):
 *   - NO cierra por click afuera (no es un popover liviano; demanda decisión explícita).
 *   - Cierra por: "Ir" (navega + cierra), "Cancelar", Esc, re-clic en disparador.
 *   - Focus trap mientras está abierto; foco vuelve al disparador al cerrar.
 *
 * Rueda Mes: nombre del mes, ▲▼ primarios, wrap arrastra el año ±1 (odómetro).
 * Rueda Año: input numérico mono tabular, maxLength=4; steppers siempre activos (sin rango).
 * "Ir" disabled mientras el año no tenga 4 dígitos numéricos.
 *
 * Hay DOS disparadores en el DOM (desktop y mobile), uno oculto por CSS en
 * cada breakpoint. El panel calcula su posición a partir del que sea visible
 * (el que tenga width > 0 en getBoundingClientRect).
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, ArrowRight } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Parsea "YYYY-MM" → { month: 0-11, year: number } */
function parseMonth(ym: string): { month: number; year: number } {
  const [y, m] = ym.split("-");
  return {
    year: parseInt(y ?? "2024", 10),
    month: parseInt(m ?? "1", 10) - 1,
  };
}

/** Formatea { month: 0-11, year } → "YYYY-MM" */
function formatYM(month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Verifica que el string de año tenga exactamente 4 dígitos numéricos */
function isYearComplete(yearStr: string): boolean {
  return /^\d{4}$/.test(yearStr);
}

/**
 * Devuelve el ref cuyo elemento está actualmente visible en el DOM
 * (width > 0 — el otro está oculto por display:none / hidden).
 * Si ambos son nulos o invisibles, devuelve el primero no nulo.
 */
function getVisibleRef(
  refs: Array<React.RefObject<HTMLButtonElement | null>>,
): HTMLButtonElement | null {
  for (const r of refs) {
    if (r.current && r.current.getBoundingClientRect().width > 0) {
      return r.current;
    }
  }
  return refs[0]?.current ?? null;
}

// ─── Panel del popover ────────────────────────────────────────────────────────

interface MonthJumpPanelProps {
  /** Mes/año actuales de la vista (punto de partida de las ruedas) */
  currentMonth: string;
  /** Refs de los disparadores (desktop primero, mobile segundo) */
  triggerRefs: Array<React.RefObject<HTMLButtonElement | null>>;
  /** Navega al mes elegido y cierra */
  onNavigate: (ym: string) => void;
  /** Cierra sin navegar */
  onClose: () => void;
}

function MonthJumpPanel({
  currentMonth,
  triggerRefs,
  onNavigate,
  onClose,
}: MonthJumpPanelProps) {
  const parsed = parseMonth(currentMonth);

  const [selectedMonth, setSelectedMonth] = useState(parsed.month); // 0-11
  const [yearStr, setYearStr] = useState(String(parsed.year));

  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    flipUp: boolean;
  }>({ top: 0, left: 0, flipUp: false });

  // Guard SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posición anclada al disparador visible (con flip vertical)
  useEffect(() => {
    const trigger = getVisibleRef(triggerRefs);
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const POPOVER_HEIGHT = 220; // altura aproximada del popover
    const POPOVER_WIDTH = 240;
    const GAP = 8;
    const MARGIN = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < POPOVER_HEIGHT + GAP;

    // Posición horizontal: alinear borde izq del popover con borde izq del trigger,
    // clamp para no salir del viewport.
    // En mobile el centro del pill puede estar descentrado; centramos respecto del trigger.
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
      left = window.innerWidth - POPOVER_WIDTH - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    if (flipUp) {
      setPosition({
        bottom: window.innerHeight - rect.top + GAP,
        left,
        flipUp: true,
      });
    } else {
      setPosition({
        top: rect.bottom + GAP,
        left,
        flipUp: false,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]); // re-calcular cuando se monta (los refs ya están asignados)

  // Esc cierra (equivale a Cancelar). NO se cierra por click afuera (regla P6).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        getVisibleRef(triggerRefs)?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Focus trap: Tab / Shift+Tab ciclan solo dentro del panel
  useEffect(() => {
    if (!mounted || !panelRef.current) return;

    const focusable = (): HTMLElement[] =>
      Array.from(
        panelRef.current!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    panelRef.current.addEventListener("keydown", handleTab);
    // Mover foco al primer control al montar
    const els = focusable();
    if (els.length > 0) els[0]!.focus();

    const panel = panelRef.current;
    return () => panel.removeEventListener("keydown", handleTab);
  }, [mounted]);

  // ── Handlers de rueda ──────────────────────────────────────────────────────

  function incrementMonth() {
    // Wrap circular puro: Diciembre → Enero SIN modificar el año.
    // Las dos ruedas son independientes; el año solo cambia con su propia rueda.
    setSelectedMonth((prev) => (prev === 11 ? 0 : prev + 1));
  }

  function decrementMonth() {
    // Wrap circular puro: Enero → Diciembre SIN modificar el año.
    setSelectedMonth((prev) => (prev === 0 ? 11 : prev - 1));
  }

  function incrementYear() {
    setYearStr((y) => {
      const n = parseInt(y, 10);
      return isNaN(n) ? y : String(n + 1);
    });
  }

  function decrementYear() {
    setYearStr((y) => {
      const n = parseInt(y, 10);
      return isNaN(n) ? y : String(n - 1);
    });
  }

  function handleYearInput(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo acepta dígitos numéricos, max 4 caracteres
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYearStr(raw);
  }

  // ── Confirm / Cancel ───────────────────────────────────────────────────────

  const canNavigate = isYearComplete(yearStr);

  const handleConfirm = useCallback(() => {
    if (!canNavigate) return;
    const ym = formatYM(selectedMonth, parseInt(yearStr, 10));
    onNavigate(ym);
    getVisibleRef(triggerRefs)?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNavigate, selectedMonth, yearStr, onNavigate]);

  const handleCancel = useCallback(() => {
    onClose();
    getVisibleRef(triggerRefs)?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Enter en el panel en un input: confirmar si año completo
  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      if (canNavigate) handleConfirm();
    }
  }

  if (!mounted) return null;

  const posStyle: React.CSSProperties = {
    position: "fixed",
    width: 240,
    zIndex: 60,
    left: position.left,
    ...(position.flipUp
      ? { bottom: position.bottom }
      : { top: position.top }),
  };

  const content = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Saltar a mes y año"
      aria-modal="true"
      style={posStyle}
      className="rounded-[var(--r-ctl)] border border-line bg-panel shadow-[var(--shadow-lg)] p-[14px] animate-modal-pop"
      onKeyDown={handlePanelKeyDown}
    >
      {/* ── Fila de las dos ruedas ── */}
      <div className="grid grid-cols-2 gap-[10px]">

        {/* ─── Rueda Mes ─── */}
        <div className="flex flex-col">
          {/* Label eyebrow */}
          <span className="mb-[6px] text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
            Mes
          </span>
          {/*
           * Contenedor único cohesivo: borde --line-strong envolvente,
           * radio --r-ctl 10px, bg-panel, overflow-hidden.
           * Las tres zonas (▲ / valor / ▼) son hijos del mismo div;
           * los divisores internos --hair las separan.
           * Ninguna zona lleva fondo propio en reposo — heredan bg-panel.
           */}
          <div
            className="flex flex-col overflow-hidden bg-panel"
            style={{
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--r-ctl)",
            }}
          >
            {/* Zona ▲ */}
            <button
              type="button"
              onClick={incrementMonth}
              aria-label="Mes siguiente"
              className={[
                "flex h-[28px] w-full items-center justify-center",
                "text-ink-2 transition-colors duration-[140ms]",
                "hover:bg-panel-2 hover:text-ink",
                "active:bg-panel-3",
                // focus ring inset para no romper el borde envolvente
                "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
            >
              <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* Divisor interno --hair */}
            <div aria-hidden="true" style={{ height: 1, background: "var(--hair)" }} />

            {/* Zona valor: nombre del mes (UI, no mono) */}
            <div
              className="flex h-[40px] items-center justify-center select-none bg-panel"
              aria-label="Mes"
              role="spinbutton"
              aria-valuenow={selectedMonth + 1}
              aria-valuemin={1}
              aria-valuemax={12}
              aria-valuetext={MONTH_NAMES[selectedMonth]}
            >
              <span className="text-[15px] font-semibold text-ink truncate px-2">
                {MONTH_NAMES[selectedMonth]}
              </span>
            </div>

            {/* Divisor interno --hair */}
            <div aria-hidden="true" style={{ height: 1, background: "var(--hair)" }} />

            {/* Zona ▼ */}
            <button
              type="button"
              onClick={decrementMonth}
              aria-label="Mes anterior"
              className={[
                "flex h-[28px] w-full items-center justify-center",
                "text-ink-2 transition-colors duration-[140ms]",
                "hover:bg-panel-2 hover:text-ink",
                "active:bg-panel-3",
                "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
            >
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ─── Rueda Año ─── */}
        <div className="flex flex-col">
          {/* Label eyebrow */}
          <span className="mb-[6px] text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
            Año
          </span>
          {/* Contenedor cohesivo — misma estructura que la rueda Mes */}
          <div
            className="flex flex-col overflow-hidden bg-panel"
            style={{
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--r-ctl)",
            }}
          >
            {/* Zona ▲ */}
            <button
              type="button"
              onClick={incrementYear}
              aria-label="Año siguiente"
              className={[
                "flex h-[28px] w-full items-center justify-center",
                "text-ink-2 transition-colors duration-[140ms]",
                "hover:bg-panel-2 hover:text-ink",
                "active:bg-panel-3",
                "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
            >
              <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* Divisor interno --hair */}
            <div aria-hidden="true" style={{ height: 1, background: "var(--hair)" }} />

            {/* Zona valor: input numérico mono tabular (regla dura 3, es cifra) */}
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={yearStr}
              onChange={handleYearInput}
              aria-label="Año"
              className={[
                "h-[40px] w-full bg-panel text-center",
                "font-mono text-[17px] font-semibold text-ink tracking-[-0.01em]",
                // focus ring inset — no rompe el borde envolvente de la pieza
                "focus:outline-none focus:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
              style={{ fontFeatureSettings: '"tnum" 1', borderRadius: 0 }}
            />

            {/* Divisor interno --hair */}
            <div aria-hidden="true" style={{ height: 1, background: "var(--hair)" }} />

            {/* Zona ▼ */}
            <button
              type="button"
              onClick={decrementYear}
              aria-label="Año anterior"
              className={[
                "flex h-[28px] w-full items-center justify-center",
                "text-ink-2 transition-colors duration-[140ms]",
                "hover:bg-panel-2 hover:text-ink",
                "active:bg-panel-3",
                "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
            >
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

      </div>

      {/* ── Divisor ── */}
      <div className="my-[12px] h-px bg-hair" aria-hidden="true" />

      {/* ── Footer: Cancelar + Ir ── */}
      <div className="flex items-center justify-end gap-[8px]">
        {/* Cancelar — ghost */}
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center rounded-[var(--r-ctl)] px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          Cancelar
        </button>
        {/* Ir — primario índigo */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canNavigate}
          aria-disabled={!canNavigate}
          className={[
            "inline-flex items-center gap-[6px] rounded-[var(--r-ctl)] px-3 py-1.5",
            "text-[13px] font-semibold text-white",
            "bg-accent transition-colors duration-[140ms]",
            "shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]",
            "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
            canNavigate
              ? "hover:bg-accent-press cursor-pointer"
              : "opacity-50 cursor-not-allowed pointer-events-none",
          ].join(" ")}
        >
          Ir
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── Ícono ChevronsUpDown ─────────────────────────────────────────────────────

/**
 * Ícono "doble chevron vertical" (↕): representa la metáfora de rueda/selector.
 * Lucide exporta ChevronsUpDown en versiones recientes. Acá usamos SVG inline
 * para no depender de la versión exacta instalada.
 */
function ChevronUpDownIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Chevron arriba */}
      <path d="M8 9l4-4 4 4" />
      {/* Chevron abajo */}
      <path d="M8 15l4 4 4-4" />
    </svg>
  );
}

// ─── MonthJumpTriggerDesktop ──────────────────────────────────────────────────

/**
 * Disparador desktop: envuelve el H1 "Junio 2026" en un <button> con glifo ChevronsUpDown.
 * El eyebrow y el sub-label de estado quedan FUERA del botón (per spec §1).
 */
interface MonthJumpTriggerDesktopProps {
  periodLabel: string;
  isOpen: boolean;
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function MonthJumpTriggerDesktop({
  periodLabel,
  isOpen,
  onClick,
  triggerRef,
}: MonthJumpTriggerDesktopProps) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className={[
        "inline-flex items-center gap-[8px] cursor-pointer",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-chip)]",
        "group",
      ].join(" ")}
    >
      <span className="text-[32px] font-bold tracking-[-0.02em] leading-none text-ink">
        {periodLabel}
      </span>
      {/* ChevronsUpDown 18px: --faint en reposo, --ink-2 en hover/abierto */}
      <ChevronUpDownIcon
        size={18}
        className={[
          "shrink-0 transition-colors duration-[140ms]",
          isOpen
            ? "text-ink-2"
            : "text-faint group-hover:text-ink-2",
        ].join(" ")}
      />
    </button>
  );
}

// ─── MonthJumpTriggerMobile ───────────────────────────────────────────────────

/**
 * Disparador mobile: el centro del pill .stepper pasa a <button>.
 * Las flechas ‹ › del pill siguen como botones separados (sin cambio).
 * El pill ya NO es aria-hidden en su totalidad; solo las flechas mantienen
 * su aria-label propio y el centro es el disparador accionable.
 */
interface MonthJumpTriggerMobileProps {
  mesName: string;
  yearName: string;
  statusLabel: string;
  isOpen: boolean;
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function MonthJumpTriggerMobile({
  mesName,
  yearName,
  statusLabel,
  isOpen,
  onClick,
  triggerRef,
}: MonthJumpTriggerMobileProps) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={`${mesName} ${yearName} — saltar a mes y año`}
      className={[
        "min-w-[124px] flex flex-col items-center gap-0 px-1 cursor-pointer",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-chip)]",
        "group",
      ].join(" ")}
    >
      <span className="flex items-center gap-[6px]">
        <span className="text-[14.5px] font-semibold text-ink">
          {mesName} {yearName}
        </span>
        {/* ChevronsUpDown 15px */}
        <ChevronUpDownIcon
          size={15}
          className={[
            "shrink-0 transition-colors duration-[140ms]",
            isOpen
              ? "text-ink-2"
              : "text-faint group-hover:text-ink-2",
          ].join(" ")}
        />
      </span>
      <span className="block text-[11px] font-medium text-muted tracking-[0.02em] -mt-0.5">
        {statusLabel}
      </span>
    </button>
  );
}

// ─── Hook compuesto: estado del popover + refs dual ───────────────────────────

/**
 * useMonthJump — administra el estado del popover y expone refs para
 * los dos disparadores (desktop + mobile) y props para el panel.
 */
export interface UseMonthJumpOptions {
  currentMonth: string;
  onNavigate: (ym: string) => void;
}

export interface UseMonthJumpReturn {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  /** Ref para el disparador desktop (H1) */
  triggerRefDesktop: React.RefObject<HTMLButtonElement | null>;
  /** Ref para el disparador mobile (centro del pill) */
  triggerRefMobile: React.RefObject<HTMLButtonElement | null>;
  /** Props listas para pasar al MonthJumpPanel */
  panelProps: {
    currentMonth: string;
    triggerRefs: Array<React.RefObject<HTMLButtonElement | null>>;
    onNavigate: (ym: string) => void;
    onClose: () => void;
  };
}

export function useMonthJump({
  currentMonth,
  onNavigate,
}: UseMonthJumpOptions): UseMonthJumpReturn {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRefDesktop = useRef<HTMLButtonElement>(null);
  const triggerRefMobile = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleNavigate = useCallback(
    (ym: string) => {
      setIsOpen(false);
      onNavigate(ym);
    },
    [onNavigate],
  );

  return {
    isOpen,
    toggle,
    close,
    triggerRefDesktop,
    triggerRefMobile,
    panelProps: {
      currentMonth,
      triggerRefs: [triggerRefDesktop, triggerRefMobile],
      onNavigate: handleNavigate,
      onClose: close,
    },
  };
}

// ─── Re-export del panel ─────────────────────────────────────────────────────

export { MonthJumpPanel };
