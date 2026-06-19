"use client";

/**
 * PeriodNav — Navegación de período con flechas gigantes laterales.
 *
 * Patrón genérico: ‹ [contenido] › donde las flechas viven en columnas
 * propias a los costados de la columna de contenido.
 *
 * Layout de 3 columnas (spec Fase 1.1.3 — revisado Fase 1.2.0):
 *   grid-template-columns: auto  minmax(0, 1120px)  auto
 *   - Las dos columnas laterales son "auto" (ancho intrínseco del botón + aire),
 *     lo que las hace SIMÉTRICAS respecto del contenido, independientemente de
 *     que el <main> esté corrido por el sidebar.
 *   - La columna central lleva el cap de 1120px y el px-10 interno.
 *   - align-items: stretch → las celdas de flecha son tan altas como el contenido
 *     (o 100vh como mínimo — ver abajo).
 *
 * Dos regímenes responsive:
 *  - ≥941px: layout de 3 columnas. Flechas 64×64, glifo 46px, sin fondo en reposo.
 *  - ≤940px: las celdas de flecha se ocultan; el consumidor renderiza el stepper
 *    compacto en el encabezado (sin cambios respecto de la versión anterior).
 *
 * Centrado vertical de las flechas al VIEWPORT (Fase 1.2.0 — spec canónica):
 *  - La flecha está SIEMPRE centrada en el centro vertical del viewport,
 *    tanto con listas largas como con listas cortas. Es el comportamiento que
 *    tenía al scrollear listas largas: la flecha permanece anclada al centro
 *    del viewport mientras se hace scroll — y ese comportamiento es el deseado
 *    para TODOS los casos de largo de contenido.
 *  - Implementación: sticky top-[50vh] -translate-y-1/2 en el botón.
 *  - Caso de listas cortas (el bug corregido): cuando el contenido es más bajo
 *    que el viewport, la celda lateral —que se estira al alto del contenido vía
 *    align-items:stretch— quedaba más corta que el viewport y el sticky no tenía
 *    recorrido para llegar al 50vh → la flecha quedaba pegada arriba.
 *    Solución: min-height:100vh en las celdas laterales. Así la celda siempre
 *    tiene al menos un viewport de alto, el sticky tiene recorrido suficiente
 *    y la flecha se posiciona en el centro del viewport incluso con poco contenido.
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
     *   permitiendo que la flecha se centre dentro de su propia celda.
     * - justify-content: center → las 3 pistas se centran como bloque dentro del
     *   área de <main> (mx-auto no centra pistas de grid; solo justify-content lo hace).
     * - En ≤940px las celdas de flecha van hidden; el stepper vive en el header.
     *
     * Implementado con estilo inline para los valores no soportables
     * como clase arbitraria de Tailwind (grid-template-columns con
     * minmax + auto simultáneo).
     */
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1120px) auto",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      {/* ── Celda flecha anterior ‹ ─────────────────────────────────── */}
      {/*
       * hidden en ≤940px; visible (block) en ≥941px.
       * padding-right: 20px → aire flecha↔contenido (el único separador, sin column-gap).
       * La celda se estira al alto del contenido (align-items:stretch del grid padre),
       * con un mínimo de 100vh: esto garantiza que el sticky de la flecha siempre
       * tenga recorrido suficiente para llegar al 50vh, tanto con listas largas
       * como con listas cortas. Sin min-height:100vh, una celda corta no deja
       * "espacio de carrera" al sticky y la flecha quedaba pegada arriba.
       */}
      <div
        className="hidden [@media(min-width:941px)]:block"
        style={{ paddingRight: 20, minHeight: "100vh" }}
      >
        {/*
         * sticky top-[50vh] -translate-y-1/2: ancla la flecha al centro
         * vertical del viewport. El sticky necesita que la celda sea más alta
         * que el viewport para tener recorrido; de eso se encarga el min-height
         * de arriba. Resultado: flecha siempre en el centro del viewport,
         * constante al scrollear, con cualquier cantidad de contenido.
         */}
        <PeriodNavButton
          label={prevLabel}
          disabled={!canGoPrev}
          onClick={onPrev}
          side="prev"
          sticky
        />
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
      {/*
       * Mismo patrón que la celda anterior: block + min-height:100vh + sticky
       * en el botón para centrado al viewport robusto (Fase 1.2.0 canónico).
       */}
      <div
        className="hidden [@media(min-width:941px)]:block"
        style={{ paddingLeft: 20, minHeight: "100vh" }}
      >
        <PeriodNavButton
          label={nextLabel}
          disabled={!canGoNext}
          onClick={onNext}
          side="next"
          sticky
        />
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
  /** Cuando true, aplica sticky top-[50vh] -translate-y-1/2 para centrar al viewport. */
  sticky?: boolean;
}

function PeriodNavButton({ label, disabled, onClick, side, sticky: useSticky }: PeriodNavButtonProps) {
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
       * sticky top-[50vh] -translate-y-1/2: ancla la flecha al centro vertical
       * del viewport. Requiere que la celda contenedora tenga min-height:100vh
       * (garantizado por el padre) para que el sticky tenga recorrido.
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
        // Centrado al viewport via sticky (si aplica)
        useSticky && "sticky top-[50vh] -translate-y-1/2",
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
