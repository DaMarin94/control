"use client";

/**
 * KebabMenu — menú de tres puntos (MoreVertical) para acciones de fila.
 *
 * Motivación: las tarjetas de lista usan `overflow-hidden` y el contenedor
 * de página usa `animate-screen-fade` (que aplica `transform`, creando un
 * containing block). Ambas razones impiden que un menú `absolute` o `fixed`
 * salga del clip. La solución es renderizar el panel desplegable vía
 * `createPortal` a `document.body` con posición `fixed` calculada desde el
 * `getBoundingClientRect()` del trigger.
 *
 * Patrón SSR: guard con `useState(mounted)` + `useEffect` (misma técnica que
 * los modales del proyecto) para evitar mismatch de hidratación.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KebabMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

export interface KebabMenuProps {
  /** aria-label del botón trigger */
  ariaLabel: string;
  items: KebabMenuItem[];
  /** Clases extra para el trigger (ej. control de visibilidad por hover desde el padre) */
  className?: string;
}

interface MenuPosition {
  top: number;
  right: number;
  openUpward: boolean;
}

/**
 * Altura estimada de cada ítem del panel (fila ~33px, ver padding vertical
 * py-[7px] + texto 13.5px) — se combina con la CANTIDAD REAL de ítems para
 * decidir si el panel abre hacia arriba. Corrección (docs/design.md
 * §"Duplicar movimiento" — 5.º ítem del menú): una constante fija (antes
 * 120px) queda corta con 5 ítems (~173px reales) y el panel abierto en el
 * pie del listado se corta contra el viewport. Deriva de `items.length` para
 * que el contrato ("el menú siempre entra entero, con cualquier cantidad de
 * ítems") se sostenga sin importar cuántas acciones tenga el menú.
 */
const PANEL_ITEM_HEIGHT = 33;
/** Padding vertical del panel (4px arriba + 4px abajo, ver `padding: "4px"` del panel) */
const PANEL_PADDING = 8;
/** Gap entre el trigger y el panel */
const GAP = 6;

export function KebabMenu({ ariaLabel, items, className }: KebabMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition>({ top: 0, right: 0, openUpward: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  /* Cerrar al hacer click fuera, presionar Escape, o al scroll/resize */
  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      // Si el click es sobre el trigger mismo, dejamos que el toggle del trigger lo maneje
      if (triggerRef.current?.contains(e.target as Node)) return;
      // Si el click es dentro del panel (portal a body), no cerrar — el click del ítem aún no disparó
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

  function handleTriggerClick(e: React.MouseEvent) {
    e.stopPropagation();

    if (open) {
      setOpen(false);
      return;
    }

    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const estimatedPanelHeight = items.length * PANEL_ITEM_HEIGHT + PANEL_PADDING;
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedPanelHeight + GAP;

    setPos({
      top: openUpward ? rect.top - GAP : rect.bottom + GAP,
      right: window.innerWidth - rect.right,
      openUpward,
    });
    setOpen(true);
  }

  const panel = open && mounted && (
    <div
      ref={panelRef}
      role="menu"
      aria-label={ariaLabel}
      className="animate-modal-pop"
      style={{
        position: "fixed",
        top: pos.openUpward ? undefined : pos.top,
        bottom: pos.openUpward ? window.innerHeight - pos.top : undefined,
        right: pos.right,
        zIndex: 80,
        minWidth: 160,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-ctl)",
        boxShadow: "var(--shadow-lg)",
        padding: "4px",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            role="menuitem"
            type="button"
            className={cn(
              "flex w-full items-center gap-[9px] text-left",
              "px-3 py-[7px] rounded-[7px]",
              "text-[13.5px] font-ui cursor-pointer",
              "transition-colors duration-[100ms]",
              item.danger
                ? "text-expense-ink hover:bg-expense-soft"
                : "text-ink hover:bg-panel-2",
            )}
            onClick={(e) => {
              e.stopPropagation();
              item.onSelect();
              setOpen(false);
            }}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[8px]",
          "border border-transparent bg-transparent",
          "text-muted transition-colors duration-[140ms]",
          "hover:bg-panel-3 hover:text-ink",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          /* Cuando el menú está abierto, el trigger debe seguir visible aunque
             el padre lo oculte con opacity-0 group-hover:opacity-100 */
          open && "opacity-100",
          className,
        )}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {mounted && open && createPortal(panel, document.body)}
    </>
  );
}
