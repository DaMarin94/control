"use client";

/**
 * PeriodNav — Navegación de período con flechas gigantes laterales.
 *
 * Patrón genérico: ‹ [contenido] › donde las flechas viven en columnas
 * propias a los costados de la columna de contenido.
 *
 * Layout de 3 columnas (spec Fase 1.1.3 — contenedor revisado 2026-06-16):
 *   grid-template-columns: auto  minmax(0, 1120px)  auto
 *   - Las dos columnas laterales son "auto" (ancho intrínseco del botón + aire),
 *     lo que las hace SIMÉTRICAS respecto del contenido, independientemente de
 *     que el <main> esté corrido por el sidebar.
 *   - La columna central lleva el cap de 1120px y el px-10 interno.
 *   - align-items: stretch → las celdas de flecha son tan altas como el contenido,
 *     lo que habilita el sticky dentro de la celda.
 *
 * Dos regímenes responsive:
 *  - ≥941px: layout de 3 columnas. Flechas 64×64, glifo 46px, sin fondo en reposo.
 *  - ≤940px: las celdas de flecha se ocultan; el consumidor renderiza el stepper
 *    compacto en el encabezado (sin cambios respecto de la versión anterior).
 *
 * Props:
 *  - children: contenido de la columna central (ya debe incluir px-10 y max-w).
 *  - prevLabel: aria-label del botón anterior (ej. "Mes anterior").
 *  - nextLabel: aria-label del botón siguiente (ej. "Mes siguiente").
 *  - onPrev: handler al ir al período anterior.
 *  - onNext: handler al ir al período siguiente.
 *  - canGoPrev: si el período anterior está disponible (false → disabled).
 *  - canGoNext: si el período siguiente está disponible (false → disabled).
 *
 * Reutilización (Fase 1.1.5): el mismo componente sirve para navegar año
 * pasando prevLabel="Año anterior", nextLabel="Año siguiente" y los flags
 * canGoPrev/canGoNext atados a earliestYear / año en curso.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PeriodNavProps {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

export function PeriodNav({
  children,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
}: PeriodNavProps) {
  return (
    /*
     * Grid de 3 columnas: [flecha ‹] [contenido max 1120px] [flecha ›]
     *
     * - Las celdas de flecha son "auto" (toman el ancho del botón + su padding).
     * - Ambas son el mismo "auto" → simétricas respecto del contenido.
     * - align-items: stretch → celdas de flecha tan altas como el contenido,
     *   habilitando el sticky dentro de cada celda.
     * - justify-content: center → las 3 pistas se centran como bloque dentro del
     *   área de <main> (mx-auto no centra pistas de grid; solo justify-content lo hace).
     * - En ≤940px las celdas de flecha van hidden; el stepper vive en el header.
     *
     * Implementado con estilo inline para los valores no soportables
     * como clase arbitraria de Tailwind (grid-template-columns con
     * minmax + auto simultáneo).
     */
    <div
      className="items-stretch"
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1120px) auto",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      {/* ── Celda flecha anterior ‹ ─────────────────────────────────── */}
      {/*
       * hidden en ≤940px; visible (flex) en ≥941px.
       * padding-right: 16px → aire flecha↔contenido (el único separador, sin column-gap).
       * La celda se estira al alto del contenido (align-items:stretch del grid padre).
       */}
      <div
        className="hidden [@media(min-width:941px)]:flex items-start"
        style={{ paddingRight: 20 }}
      >
        {/*
         * Sticky dentro de la celda: el botón se centra verticalmente en el viewport
         * mientras el usuario hace scroll por listas largas.
         * top: 50vh + translateY(-50%) = centro exacto del viewport.
         */}
        <div className="sticky top-[50vh] -translate-y-1/2">
          <PeriodNavButton
            label={prevLabel}
            disabled={!canGoPrev}
            onClick={onPrev}
            side="prev"
          />
        </div>
      </div>

      {/* ── Columna de contenido ─────────────────────────────────────── */}
      {/*
       * min-width: 0 obligatorio para que minmax(0, 1120px) realmente pueda
       * encoger por debajo de 1120px (sin esto la celda no se encoge).
       */}
      <div style={{ minWidth: 0 }}>
        {children}
      </div>

      {/* ── Celda flecha siguiente › ─────────────────────────────────── */}
      <div
        className="hidden [@media(min-width:941px)]:flex items-start"
        style={{ paddingLeft: 20 }}
      >
        <div className="sticky top-[50vh] -translate-y-1/2">
          <PeriodNavButton
            label={nextLabel}
            disabled={!canGoNext}
            onClick={onNext}
            side="next"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Botón de flecha ──────────────────────────────────────────────────────────

interface PeriodNavButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  side: "prev" | "next";
}

function PeriodNavButton({ label, disabled, onClick, side }: PeriodNavButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-disabled={disabled}
      /*
       * Tamaño único: 64×64px circular (spec 1.1.3 revisada).
       * Glifo: 46px, stroke-width 1.75 (ver ChevronLeft/Right abajo).
       *
       * Estados:
       *  reposo:  glifo --faint, fondo transparente.
       *  hover:   glifo --ink, fondo circular --panel-2.
       *  active:  fondo --panel-3, glifo --ink.
       *  focus:   anillo --accent-soft (focus-visible).
       *  disabled: opacity 0.4, cursor default, sin hover.
       *
       * prefers-reduced-motion: sin transición (motion-reduce:transition-none).
       */
      className={[
        // Forma circular, centrado, tamaño único 64×64
        "flex items-center justify-center rounded-full",
        "w-16 h-16",
        // Transición de color (hover estándar DS 0.14s)
        "transition-colors duration-[140ms] motion-reduce:transition-none",
        // Glifo en reposo: --faint
        "text-faint",
        // Fondo en reposo: transparente (sin fill; es affordance "al aire")
        "bg-transparent",
        // Hover — solo cuando no está disabled
        !disabled && "hover:text-ink hover:bg-panel-2",
        // Active
        !disabled && "active:bg-panel-3 active:text-ink",
        // Focus visible — anillo DS
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        // Disabled: opacidad, cursor, sin hover
        disabled ? "opacity-40 cursor-default" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {side === "prev" ? (
        <ChevronLeft
          aria-hidden="true"
          size={46}
          strokeWidth={1.75}
        />
      ) : (
        <ChevronRight
          aria-hidden="true"
          size={46}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}
