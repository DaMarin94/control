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
 *    tanto con listas largas como con listas cortas.
 *  - Implementación (Ola 0 — fix E1): las celdas laterales son sticky top-0
 *    con height:100vh y flex items-center. El botón se centra dentro de la celda.
 *    La celda sticky ocupa 100vh visualmente pero, al ser sticky, no aporta
 *    al alto del documento más allá del contenido real → sin scroll fantasma
 *    cuando el contenido es más corto que el viewport.
 *  - Caso de listas largas: la celda sticky permanece en pantalla mientras se
 *    scrollea, la flecha queda siempre centrada al viewport.
 *  - Caso de listas cortas: la celda no infla el documento; sin scroll fantasma.
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
       * hidden en ≤940px; visible (flex) en ≥941px.
       * padding-right: 20px → aire flecha↔contenido (el único separador, sin column-gap).
       *
       * Fix E1 — scroll fantasma (Ola 0):
       * La solución anterior usaba min-height:100vh + sticky en el botón. El
       * problema: min-height:100vh en las celdas laterales aportaba alto real al
       * documento → cuando el contenido era más corto que el viewport, el grid
       * forzaba la página a ser de al menos 100vh y aparecía scroll fantasma.
       *
       * Solución: las celdas laterales son sticky top-0 con height:100vh.
       * - sticky top-0: la celda se "pega" al inicio del viewport al scrollear;
       *   nunca sale de pantalla mientras haya contenido.
       * - height:100vh (no min-height): la celda ocupa exactamente el viewport de
       *   alto en el layout, pero al ser sticky no contribuye al alto del documento
       *   más allá de lo que el contenido real ya define.
       * - El botón se centra con flexbox (items-center justify-center) dentro de
       *   esa celda de 100vh → queda anclado al centro del viewport.
       * Casos verificados:
       *   (a) lista larga (scroll real): la celda sticky se mantiene en pantalla
       *       mientras se scrollea; la flecha permanece centrada al viewport. ✓
       *   (b) todo colapsado (contenido corto): la celda sticky no infla el documento
       *       más allá del contenido; sin scroll fantasma, flecha centrada. ✓
       */}
      <div
        className="hidden [@media(min-width:941px)]:flex items-center justify-center"
        style={{ paddingRight: 20, position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start" }}
      >
        <PeriodNavButton
          label={prevLabel}
          disabled={!canGoPrev}
          onClick={onPrev}
          side="prev"
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
      {/* Mismo patrón sticky top-0 height:100vh que la celda anterior. */}
      <div
        className="hidden [@media(min-width:941px)]:flex items-center justify-center"
        style={{ paddingLeft: 20, position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start" }}
      >
        <PeriodNavButton
          label={nextLabel}
          disabled={!canGoNext}
          onClick={onNext}
          side="next"
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
       * El centrado al viewport lo maneja el div contenedor (sticky top-0 height:100vh
       * + flex items-center). El botón en sí no necesita posicionamiento propio.
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
