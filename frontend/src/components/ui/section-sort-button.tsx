"use client";

/**
 * SectionSortButton — Toggle de orden (monto ↔ fecha) para la sección Únicos en /mes.
 * Ola 2, Sub-fase C.
 *
 * Botón ghost icon-only que alterna el criterio de orden de la sección Únicos:
 *   - "amount" (default): |amountCents| DESC (barras decrecientes, mayor magnitud arriba).
 *   - "date": occurredAt DESC (más reciente arriba), desempate por |amountCents| DESC.
 *
 * Mismo molde visual que SectionFilterButton:
 *   - Icon-only, padding px-[7px] py-[5px], radio --r-ctl, transición colors 0.14s.
 *   - Punto indicador --accent 6px cuando el orden es != default ("date").
 *   - Glifo muta: ArrowDownWideNarrow (por monto) ↔ ArrowDownNarrowWide (por fecha).
 *   - aria-pressed=true cuando orden por fecha; aria-label dinámico (anuncia próxima acción).
 *
 * NO tiene popover — es un toggle puro (sin aria-haspopup, sin aria-expanded).
 * NO se renderiza en modo orden de secciones (igual que el filtro).
 *
 * Exporta:
 *   - SectionSortButton: el botón toggle icon-only.
 *   - UnicosSort: reexportado de @/types/auth para conveniencia.
 */

import { ArrowDownWideNarrow, ArrowDownNarrowWide } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnicosSort } from "@/types/auth";

export type { UnicosSort };

interface SectionSortButtonProps {
  /** Criterio activo de orden */
  sort: UnicosSort;
  /** Callback al hacer clic — alterna sort */
  onToggle: () => void;
}

/**
 * Toggle icon-only para el orden de la sección Únicos.
 * Se ubica a la izquierda del SectionFilterButton (gap-1 entre ambos),
 * al borde derecho de la cabecera junto al subtotal.
 *
 * Solo Únicos lo lleva: Fijos y Cuotas no tienen columna fecha.
 */
export function SectionSortButton({ sort, onToggle }: SectionSortButtonProps) {
  const isDate = sort === "date";

  // aria-label anuncia la PRÓXIMA acción (igual que el spec)
  const ariaLabel = isDate ? "Ordenar por monto" : "Ordenar por fecha";

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle();
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isDate}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center justify-center rounded-ctl",
          "px-[7px] py-[5px]",
          "transition-colors duration-[140ms]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          // Activo (active/pressed CSS)
          "active:bg-panel-3",
          // Estados según si está en modo no-default (fecha) o default (monto)
          isDate
            ? "text-ink hover:bg-panel-2"
            : "text-muted hover:bg-panel-2 hover:text-ink",
        )}
      >
        {isDate ? (
          <ArrowDownNarrowWide size={15} strokeWidth={2} aria-hidden="true" />
        ) : (
          <ArrowDownWideNarrow size={15} strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {/* Punto indicador: visible cuando el orden es != default ("date") */}
      {isDate && (
        <span
          className="pointer-events-none absolute -top-[2px] -right-[2px] h-[6px] w-[6px] rounded-full bg-accent"
          style={{ border: "2px solid var(--panel)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
