"use client";

/**
 * SectionFilterPopover — Disparador + popover de filtros por sección en /mes (Fase 1.2.1).
 *
 * Cada sección de AccordionSection (Únicos / Fijos / Cuotas) tiene su propio
 * disparador icon-only (SlidersHorizontal) que abre un popover con dos bloques:
 *   1. Triple switch de tipo: Gasto / Ingreso / Ambos (default Ambos).
 *   2. Lista de categorías con checklist inline (reutiliza la lógica de 3 estados
 *      de CategoryFilterPopover, pero embebida en este popover — no portaleada por separado).
 *
 * RESTRICCIÓN DE A11Y: el disparador es un <button> hermano del <button> de la
 * cabecera del acordeón — no un hijo. El contenedor `AccordionSection` acepta un
 * prop `filterSlot` que se posiciona como sibling del disclosure button.
 *
 * El popover se portalea a document.body (patrón estándar del DS).
 * Guard SSR obligatorio: mounted + useEffect.
 *
 * Exporta:
 *   - SectionFilterButton: disparador icon-only + popover completo (usar en AccordionSection).
 *   - SectionFilterType: tipo para "ALL" | "EXPENSE" | "INCOME".
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SectionFilterType = "ALL" | "EXPENSE" | "INCOME";

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

export interface SectionFilterPopoverProps {
  sectionKey: string;
  sectionLabel: string;
  /** Universo de categorías presentes en los movimientos crudos de la sección. */
  sectionCategories: CategoryOption[];
  selectedType: SectionFilterType;
  selectedCategories: string[] | null;
  onTypeChange: (type: SectionFilterType) => void;
  onCategoriesChange: (ids: string[] | null) => void;
}

// ─── Triple switch de tipo ────────────────────────────────────────────────────

const SEGMENTS: { value: SectionFilterType; label: string }[] = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
  { value: "ALL", label: "Ambos" },
];

function TypeSwitch({
  selected,
  onChange,
}: {
  selected: SectionFilterType;
  onChange: (type: SectionFilterType) => void;
}) {
  const selectedIndex = SEGMENTS.findIndex((s) => s.value === selected);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (index + 1) % SEGMENTS.length;
      onChange(SEGMENTS[next]!.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (index - 1 + SEGMENTS.length) % SEGMENTS.length;
      onChange(SEGMENTS[prev]!.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tipo de movimiento"
      className="relative flex rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      {/* Thumb deslizante */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)] transition-[left,width] duration-[140ms] ease-out motion-reduce:transition-none"
        style={{
          left: `calc(${(selectedIndex / 3) * 100}% + 2px)`,
          width: `calc(${100 / 3}% - 4px)`,
        }}
      />
      {SEGMENTS.map((seg, i) => {
        const isSelected = seg.value === selected;
        const textColor = isSelected
          ? seg.value === "EXPENSE"
            ? "text-expense-ink"
            : seg.value === "INCOME"
              ? "text-income-ink"
              : "text-accent-ink"
          : "text-muted hover:text-ink-2";

        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(seg.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative z-10 flex-1 rounded-pill px-[10px] py-[5px]",
              "text-[12.5px] font-semibold transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              textColor,
            )}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Bloque de categorías inline ──────────────────────────────────────────────

interface InlineCategoryBlockProps {
  allCategories: { id: string; name: string; color: string }[];
  selectedCategories: string[] | null;
  onChange: (ids: string[] | null) => void;
}

function InlineCategoryBlock({
  allCategories,
  selectedCategories,
  onChange,
}: InlineCategoryBlockProps) {
  const effectiveIds: Set<string> =
    selectedCategories === null
      ? new Set(allCategories.map((c) => c.id))
      : new Set(
          selectedCategories.filter((id) => allCategories.some((c) => c.id === id)),
        );

  const allSelected =
    allCategories.length > 0 && allCategories.every((c) => effectiveIds.has(c.id));

  function toggleCategory(id: string) {
    const newSet = new Set(effectiveIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    const newList = allCategories
      .map((c) => c.id)
      .filter((cid) => newSet.has(cid));
    if (newList.length === allCategories.length) {
      onChange(null);
    } else {
      onChange(newList);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(null);
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header — shrink-0: nunca scrollea con la lista (§8.2, "categorías" es la única región flexible) */}
      <div className="shrink-0 flex items-center justify-between px-3 py-[10px] border-b border-hair">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Mostrar categorías
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-[12px] font-semibold text-accent-ink hover:underline focus-visible:outline-none"
        >
          {allSelected ? "Ninguna" : "Todas"}
        </button>
      </div>

      {/* Lista scrollable — única región flexible del panel (§8.2), min-height 120px */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ minHeight: 120 }}>
        {allCategories.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12.5px] text-muted">
            No tenés categorías.
          </p>
        ) : (
          allCategories.map((cat) => {
            const checked = effectiveIds.has(cat.id);
            return (
              <div
                key={cat.id}
                className="flex cursor-pointer items-center gap-[10px] px-3 py-2 hover:bg-panel-2"
                onClick={() => toggleCategory(cat.id)}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggleCategory(cat.id);
                  }
                }}
              >
                {/* Checkbox visual */}
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[140ms]",
                    checked ? "border-accent bg-accent" : "border-line-strong bg-panel",
                  )}
                  aria-hidden="true"
                >
                  {checked && (
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                {/* Swatch de color */}
                <span
                  className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />

                {/* Nombre */}
                <span
                  className={cn("text-[13px] font-medium", checked ? "text-ink" : "text-ink-2")}
                >
                  {cat.name}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Contención del panel (docs/design.md §8.2) ────────────────────────────────
//
// El popover pasa a ser una COLUMNA ACOTADA: `max-height: min(560px, 100dvh -
// 24px)` y anclaje INVERTIBLE hacia arriba si no entra abajo — hoy solo abría
// hacia abajo; con la banda "Simulación" (footerSlot, shrink-0) esto pasa a
// ser requisito (antes solo corría riesgo la lista de categorías). Mismo
// MECANISMO que `KebabMenu`/`use-listbox-popover.ts` (medir en dos pasadas:
// estimado antes de pintar, alto real una vez montado, para flip sin salto
// visible) — no se reusa el hook `useListboxPosition` porque ese ancla por la
// IZQUIERDA con ancho = ancho del trigger; este panel ancla por la DERECHA con
// ancho fijo (260px), semántica distinta.

const PANEL_INTRINSIC_MAX_HEIGHT = 560;
const PANEL_VIEWPORT_MARGIN = 12;
const PANEL_GAP = 6;

interface PanelPosition {
  top: number;
  right: number;
  maxHeight: number;
}

function usePanelPosition(
  anchorRef: React.RefObject<HTMLButtonElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>,
) {
  const [position, setPosition] = useState<PanelPosition>({
    top: 0,
    right: 0,
    maxHeight: PANEL_INTRINSIC_MAX_HEIGHT,
  });

  const calc = useCallback(
    (panelHeight: number) => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const cap = Math.min(PANEL_INTRINSIC_MAX_HEIGHT, vh - PANEL_VIEWPORT_MARGIN * 2);

      const spaceBelow = vh - rect.bottom - PANEL_VIEWPORT_MARGIN;
      const spaceAbove = rect.top - PANEL_VIEWPORT_MARGIN;

      let top: number;
      let maxHeight = cap;

      if (panelHeight + PANEL_GAP <= spaceBelow) {
        // Preferencia: abajo del disparador (comportamiento de hoy).
        top = rect.bottom + PANEL_GAP;
      } else if (panelHeight + PANEL_GAP <= spaceAbove) {
        // Flip: abre hacia arriba.
        top = rect.top - panelHeight - PANEL_GAP;
      } else {
        // No entra en ningún lado: lado con más espacio, maxHeight clampeado
        // al disponible — la lista de categorías scrollea dentro de sí.
        const available = Math.max(spaceAbove, spaceBelow);
        maxHeight = Math.min(cap, available - PANEL_GAP);
        top =
          spaceAbove > spaceBelow
            ? Math.max(PANEL_VIEWPORT_MARGIN, rect.top - maxHeight - PANEL_GAP)
            : rect.bottom + PANEL_GAP;
      }

      setPosition({ top, right: window.innerWidth - rect.right, maxHeight });
    },
    [anchorRef],
  );

  // Primera pasada: estimado, antes de que el panel pinte (evita el salto).
  useEffect(() => {
    calc(PANEL_INTRINSIC_MAX_HEIGHT);
  }, [calc]);

  // Segunda pasada: alto real del panel, una vez montado.
  useEffect(() => {
    if (!panelRef.current) return;
    const real = panelRef.current.getBoundingClientRect().height;
    if (real > 0) calc(real);
  }, [calc, panelRef]);

  return position;
}

// ─── Panel del popover (portaleado) ──────────────────────────────────────────

interface SectionFilterPanelProps extends SectionFilterPopoverProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  /**
   * Banda "Simulación" (docs/design.md §2) — SOLO la sección Únicos la pasa.
   * Render-prop: recibe `closePopover` para que sus acciones (abrir el modal
   * de crear / la confirmación de eliminar) cierren este popover ANTES de
   * abrir el otro overlay (invariante "un solo overlay a la vez"). Mantiene
   * a este componente de `ui/` agnóstico del dominio de simulaciones.
   */
  footerSlot?: (closePopover: () => void) => ReactNode;
}

function SectionFilterPanel({
  sectionKey,
  sectionLabel,
  selectedType,
  selectedCategories,
  sectionCategories,
  onTypeChange,
  onCategoriesChange,
  anchorRef,
  onClose,
  footerSlot,
}: SectionFilterPanelProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const position = usePanelPosition(anchorRef, popoverRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScrollClose(e: Event) {
      // Ignorar scrolls originados dentro del popover (ej. lista de categorías,
      // o la lista de simulaciones activas de la banda). El listener es
      // capture=true, por lo que e.target es el elemento real que scrolleó.
      if (
        popoverRef.current &&
        e.target instanceof Node &&
        popoverRef.current.contains(e.target)
      ) {
        return;
      }
      onClose();
    }
    function handleResizeClose() {
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("scroll", handleScrollClose, true);
    window.addEventListener("resize", handleResizeClose);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("scroll", handleScrollClose, true);
      window.removeEventListener("resize", handleResizeClose);
    };
  }, [onClose, anchorRef]);

  if (!mounted) return null;

  const content = (
    <div
      ref={popoverRef}
      className="fixed z-50 flex w-[260px] flex-col rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] animate-modal-pop overflow-hidden"
      style={{
        top: position.top,
        right: position.right,
        maxHeight: position.maxHeight,
      }}
      role="dialog"
      aria-label={`Filtrar ${sectionLabel}`}
      data-testid={`section-filter-popover-${sectionKey}`}
    >
      {/* Bloque 1: Triple switch de tipo — shrink-0, nunca scrollea (§8.2) */}
      <div className="shrink-0 px-3 py-[10px] border-b border-hair">
        <span className="block mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Mostrar
        </span>
        <TypeSwitch selected={selectedType} onChange={onTypeChange} />
      </div>

      {/* Bloque 2: Categorías embebidas — única región flexible del panel (§8.2) */}
      <InlineCategoryBlock
        allCategories={sectionCategories}
        selectedCategories={selectedCategories}
        onChange={onCategoriesChange}
      />

      {/* Bloque 3: banda "Simulación" — shrink-0, solo Únicos (§2) */}
      {footerSlot?.(onClose)}
    </div>
  );

  return createPortal(content, document.body);
}

// ─── SectionFilterButton — disparador icon-only + popover ─────────────────────

/**
 * Disparador icon-only para el popover de filtros de sección.
 * Se ubica como hermano del <button> de la cabecera del acordeón (filterSlot).
 *
 * "Filtro activo" = tipo ≠ ALL OR categorías ≠ todas (null).
 * En ese caso: punto indicador --accent en la esquina sup-der del botón,
 * ícono sube a --ink en reposo. Una simulación activa NO enciende este punto
 * (docs/design.md §2 — sigue significando solo "sección filtrada").
 *
 * El popover se portalea a body para evitar el containing-block del ancestor
 * transformado (animate-screen-fade) — mismo patrón que KebabMenu y los modales.
 */
export interface SectionFilterButtonProps extends SectionFilterPopoverProps {
  /** Banda "Simulación" (§2) — solo la sección Únicos la pasa. Ver `SectionFilterPanelProps.footerSlot`. */
  footerSlot?: (closePopover: () => void) => ReactNode;
}

export function SectionFilterButton({
  sectionKey,
  sectionLabel,
  sectionCategories,
  selectedType,
  selectedCategories,
  onTypeChange,
  onCategoriesChange,
  footerSlot,
}: SectionFilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isFiltered = selectedType !== "ALL" || selectedCategories !== null;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsOpen((o) => !o);
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-label={`Filtrar ${sectionLabel}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center justify-center rounded-ctl",
          "px-[7px] py-[5px]",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          isOpen
            ? "bg-panel-2 text-ink"
            : isFiltered
              ? "text-ink hover:bg-panel-2"
              : "text-muted hover:bg-panel-2 hover:text-ink",
        )}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
      </button>

      {/* Punto indicador de filtro activo */}
      {isFiltered && (
        <span
          className="pointer-events-none absolute -top-[2px] -right-[2px] h-[6px] w-[6px] rounded-full bg-accent"
          style={{ border: "2px solid var(--panel)" }}
          aria-hidden="true"
        />
      )}

      {/* Popover portaleado */}
      {isOpen && (
        <SectionFilterPanel
          sectionKey={sectionKey}
          sectionLabel={sectionLabel}
          sectionCategories={sectionCategories}
          selectedType={selectedType}
          selectedCategories={selectedCategories}
          onTypeChange={onTypeChange}
          onCategoriesChange={onCategoriesChange}
          anchorRef={buttonRef}
          onClose={() => setIsOpen(false)}
          footerSlot={footerSlot}
        />
      )}
    </div>
  );
}
