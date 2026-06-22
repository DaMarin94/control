"use client";

/**
 * CardCurrencySelect — selector de moneda embebido en la cabecera de la card de reporte.
 *
 * Spec: docs/design.md, sección "Moneda por reporte — selector embebido en la cabecera
 * de la card (Ola 3, P3)".
 *
 * Anatomía:
 *   - Disparador (`CardCurrencyTrigger`): chip-dropdown in-situ, compacto (~52px).
 *     Código de moneda mono 12px/600/tnum --ink-2 + ChevronDown 12px --faint (rota a ▲ al abrir).
 *     Caja: bg-panel-3, --r-chip 7px, px-[8px] py-[3px], gap-[6px]. Sin glifo Wallet.
 *   - Popover-listbox: caja --panel/--line/--r-ctl 10px/--shadow-lg/p-[4px].
 *     4 ítems role="option", orden ARS→USD→EUR→BRL.
 *     Seleccionado: código --ink + Check 14px --ink-2. Hover: fondo --panel-2.
 *
 * A11y:
 *   - Disparador: aria-haspopup="listbox", aria-expanded.
 *   - Popover: role="listbox", aria-label="Moneda del reporte".
 *   - Ítems: role="option", aria-selected.
 *   - Teclado: ↑/↓ navegan, Enter/Espacio eligen, Esc cierra y devuelve foco al disparador.
 *
 * Cierre: selección / Esc / click fuera / re-clic en el disparador.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Orden canónico de monedas (igual que el CurrencySegmented). */
const CURRENCY_OPTIONS: CurrencyCode[] = ["ARS", "USD", "EUR", "BRL"];

/** Gap entre anchor y popover. */
const POPOVER_GAP = 4;
/** Colchón mínimo al borde del viewport. */
const VIEWPORT_MARGIN = 8;

// ─── Popover-listbox ──────────────────────────────────────────────────────────

interface CurrencyPopoverProps {
  value: CurrencyCode;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (c: CurrencyCode) => void;
  onClose: () => void;
}

function CurrencyPopover({ value, anchorRef, onSelect, onClose }: CurrencyPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  // Índice de ítem con focus de teclado
  const [focusedIdx, setFocusedIdx] = useState<number>(
    () => CURRENCY_OPTIONS.indexOf(value),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posición: alineado al borde derecho del disparador, con flip arriba.
  const calcPosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const popoverHeight = popoverEl ? popoverEl.getBoundingClientRect().height : 120;
    const vh = window.innerHeight;

    const espacioAbajo = vh - rect.bottom - VIEWPORT_MARGIN;
    const cabeAbajo = popoverHeight + POPOVER_GAP <= espacioAbajo;

    let top: number;
    if (cabeAbajo) {
      top = rect.bottom + POPOVER_GAP;
    } else {
      // flip arriba
      top = rect.top - popoverHeight - POPOVER_GAP;
      top = Math.max(VIEWPORT_MARGIN, top);
    }

    // Alineado al borde DERECHO del disparador (crece hacia la izquierda)
    const right = window.innerWidth - rect.right;

    setPosition({ top, right });
  }, [anchorRef]);

  // Primera pasada antes del paint, segunda con medidas reales
  useEffect(() => {
    calcPosition();
  }, [calcPosition]);

  useEffect(() => {
    if (!mounted) return;
    calcPosition();
  }, [mounted, calcPosition]);

  // Click fuera → cerrar
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [anchorRef, onClose]);

  // Teclado: ↑/↓ navegan, Enter/Espacio eligen, Esc cierra
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIdx((i) => (i + 1) % CURRENCY_OPTIONS.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIdx((i) => (i - 1 + CURRENCY_OPTIONS.length) % CURRENCY_OPTIONS.length);
          break;
        case "Enter":
        case " ": {
          e.preventDefault();
          const opt = CURRENCY_OPTIONS[focusedIdx];
          if (opt) {
            onSelect(opt);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          onClose();
          anchorRef.current?.focus();
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedIdx, onSelect, onClose, anchorRef]);

  if (!mounted) return null;

  const content = (
    <div
      ref={popoverRef}
      role="listbox"
      aria-label="Moneda del reporte"
      className={cn(
        "fixed z-50 min-w-[96px] rounded-ctl border border-line bg-panel",
        "shadow-[var(--shadow-lg)] p-[4px] animate-modal-pop",
      )}
      style={{ top: position.top, right: position.right }}
    >
      {CURRENCY_OPTIONS.map((code, idx) => {
        const isSelected = code === value;
        const isFocused = idx === focusedIdx;
        return (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(code)}
            onMouseEnter={() => setFocusedIdx(idx)}
            className={cn(
              "flex w-full items-center justify-between gap-[8px]",
              "px-[10px] py-[6px] rounded-[7px] cursor-pointer",
              "transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              isFocused && !isSelected ? "bg-panel-2" : "",
              isSelected ? "bg-transparent" : "",
              !isFocused && !isSelected ? "hover:bg-panel-2" : "",
            )}
          >
            {/* Código mono 13px/600/tnum */}
            <span
              className={cn(
                "mono text-[13px] font-semibold",
                "[font-feature-settings:'tnum'_1]",
                isSelected ? "text-ink" : "text-ink-2",
              )}
            >
              {code}
            </span>
            {/* Check — solo en el seleccionado, no en otros */}
            {isSelected ? (
              <Check size={14} aria-hidden="true" className="shrink-0 text-ink-2" />
            ) : (
              /* Spacer para alinear el texto con el check */
              <span className="w-[14px] shrink-0" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}

// ─── CardCurrencySelect (disparador + popover) ────────────────────────────────

export interface CardCurrencySelectProps {
  /** Moneda actual de la card. */
  value: CurrencyCode;
  /** Callback al seleccionar una nueva moneda. */
  onChange: (c: CurrencyCode) => void;
}

/**
 * Chip-dropdown de moneda para la cabecera de la card de reporte.
 *
 * Monta el disparador (chip compacto) + el popover-listbox de las 4 monedas.
 * Solo se monta cuando la card tiene override de moneda (callback presente en ReportCard).
 *
 * Spec: docs/design.md §"Moneda por reporte — selector embebido en la cabecera de la card (Ola 3, P3)".
 */
export function CardCurrencySelect({ value, onChange }: CardCurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleTriggerClick() {
    setOpen((o) => !o);
  }

  function handleSelect(code: CurrencyCode) {
    onChange(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      {/* Disparador: chip compacto */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Moneda del reporte: ${value}`}
        onClick={handleTriggerClick}
        className={cn(
          "inline-flex items-center gap-[6px] px-[8px] py-[3px]",
          "rounded-[7px] cursor-pointer",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          // Reposo: panel-3 / ink-2 / faint
          // Hover o abierto: panel-2 / ink / muted
          open
            ? "bg-panel-2"
            : "bg-panel-3 hover:bg-panel-2",
        )}
      >
        {/* Código mono 12px/600/tnum --ink-2 */}
        <span
          className={cn(
            "mono text-[12px] font-semibold [font-feature-settings:'tnum'_1] tracking-[0.04em]",
            open ? "text-ink" : "text-ink-2 group-hover:text-ink",
          )}
        >
          {value}
        </span>
        {/* ChevronDown 12px --faint; rota a ▲ (−180°) al abrir */}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-[transform,color] duration-[140ms]",
            open ? "rotate-180 text-muted" : "text-faint",
          )}
        />
      </button>

      {/* Popover-listbox */}
      {open && (
        <CurrencyPopover
          value={value}
          anchorRef={triggerRef}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </>
  );
}
