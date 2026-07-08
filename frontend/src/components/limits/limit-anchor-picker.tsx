"use client";

/**
 * LimitAnchorPicker — listbox rico agrupado para elegir la key (anchorKey) de
 * un límite nuevo (docs/design.md §"Panel de gestión de límites" → 3.1).
 *
 * Reusa el molde de `PaymentMethodSelect` (trigger + panel por portal): el
 * catálogo va agrupado por superficie, con glifo de contexto — un `<select>`
 * nativo no puede mostrar esto. Encabezados de grupo NO seleccionables.
 *
 * Tramo 2: las 6 superficies tienen entradas (`getPanelAnchorsBySurface` filtra
 * por `offeredInPanel`, ya `true` para `mes.*` y las 15 keys de reportes/dashboard-
 * widget). Todas las superficies de reporte comparten el mismo glifo de contexto
 * que el sidebar usa para "Reportes" (no hay un ícono por tipo de card en el
 * sidebar, así que no se inventa uno acá).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CalendarDays, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPanelAnchorsBySurface,
  getAnchorDef,
  SURFACE_LABELS,
  type LimitSurface,
} from "@/lib/limits/catalog";

/** Glifo de contexto por superficie — mismo ícono que usa el sidebar para esa pantalla. */
const SURFACE_ICONS: Record<LimitSurface, typeof CalendarDays> = {
  mes: CalendarDays,
  "reporte-income-expense": BarChart2,
  "reporte-by-category": BarChart2,
  "reporte-unique-grid": BarChart2,
  "reporte-installment-gantt": BarChart2,
  "reporte-inflation-income": BarChart2,
};

const UNIT_CHIP_LABEL: Record<string, string> = {
  money: "monto",
  "signed-money": "monto",
  percent: "%",
  count: "cant.",
};

export interface LimitAnchorPickerProps {
  id?: string;
  /** anchorKey seleccionado; "" = ninguno */
  value: string;
  onChange: (anchorKey: string) => void;
}

const NONE_LABEL = "Elegí un dato para observar";

export function LimitAnchorPicker({ id, value, onChange }: LimitAnchorPickerProps) {
  const groups = getPanelAnchorsBySurface();
  const selected = value ? getAnchorDef(value) : undefined;

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, { capture: true });
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  function handleTriggerClick() {
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setOpen(true);
  }

  function handleSelect(anchorKey: string) {
    onChange(anchorKey);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-ctl border-[1.5px] border-line bg-panel",
          "py-[11px] pl-[13px] pr-10 relative",
          "text-[15px] text-left transition-all duration-[140ms] cursor-pointer",
          "focus-visible:outline-none focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        {selected ? (
          <span className="text-ink truncate">{selected.label}</span>
        ) : (
          <span className="text-faint truncate">{NONE_LABEL}</span>
        )}
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          size={16}
          aria-hidden="true"
        />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Dato a observar"
            className="animate-modal-pop"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 80,
              maxHeight: 320,
              overflowY: "auto",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-ctl)",
              boxShadow: "var(--shadow-lg)",
              padding: "4px",
            }}
          >
            {groups.map((group) => {
              const GroupIcon = SURFACE_ICONS[group.surface];
              return (
                <div key={group.surface}>
                  <div
                    role="presentation"
                    className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted"
                  >
                    {SURFACE_LABELS[group.surface]}
                  </div>
                  {group.anchors.map((anchor) => (
                    <button
                      key={anchor.key}
                      type="button"
                      role="option"
                      aria-selected={value === anchor.key}
                      onClick={() => handleSelect(anchor.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[7px] px-3 py-[8px] text-left text-[13.5px]",
                        value === anchor.key ? "bg-panel-2 text-ink" : "text-ink hover:bg-panel-2",
                      )}
                    >
                      <GroupIcon size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
                      <span className="flex-1 truncate">{anchor.label}</span>
                      <span className="shrink-0 rounded-chip bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]">
                        {UNIT_CHIP_LABEL[anchor.unit] ?? anchor.unit}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
