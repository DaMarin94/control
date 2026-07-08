"use client";

/**
 * AccordionSection — Sección de acordeón reutilizable (Fase 1.1.4).
 *
 * Patrón genérico: cabecera (.ghead) colapsable + cuerpo (tarjeta-lista).
 * Se instancia en /mes para Únicos / Fijos / Cuotas.
 * Puede reutilizarse en otras pantallas del proyecto.
 *
 * Accesibilidad:
 *   - La cabecera es un <button> con aria-expanded / aria-controls.
 *   - El cuerpo tiene el id correspondiente al aria-controls.
 *   - El chevron rota 90° cuando está expandido (▶ → ▼).
 *
 * Animación:
 *   - Técnica CSS grid rows: grid-rows-[0fr] ↔ grid-rows-[1fr] con overflow-hidden.
 *   - Fade de opacity 0 ↔ 1.
 *   - prefers-reduced-motion: sin animación (instantáneo).
 *   - Duración: 0.22s ease-out.
 *
 * Props:
 *   - id: identificador único de la sección (para aria-controls).
 *   - label: texto del rótulo de la cabecera.
 *   - count: número de ítems (pill contador).
 *   - subtotal: string formateado del subtotal.
 *   - isCollapsed: estado de colapso.
 *   - onToggle: callback al pulsar la cabecera.
 *   - isOrderMode: cuando true, la cabecera no dispara colapso (está en modo orden).
 *   - showGripHandle: cuando true, muestra el handle GripVertical (modo orden).
 *   - gripHandleProps: props para el handle de dnd-kit (listeners, attributes).
 *   - filterSlot: nodo opcional renderizado como HERMANO del <button> de la cabecera
 *     (NO como hijo). Requerido por la restricción de a11y: no se anidan controles
 *     interactivos dentro del <button> de disclosure. Se ubica entre el divisor flex
 *     y el subtotal visual (la fila pasa a ser un contenedor flex que envuelve el
 *     <button> y, a su derecha, el slot de filtro). Debe ocultarse en isOrderMode.
 *   - children: cuerpo de la sección (tarjeta-lista o empty inline).
 */

import { ChevronRight, GripVertical } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { cn } from "@/lib/utils";

interface AccordionSectionProps {
  id: string;
  label: string;
  count: number;
  subtotal: string;
  isCollapsed: boolean;
  onToggle: () => void;
  isOrderMode: boolean;
  /**
   * P2 — Fase 1 (marca visual pasiva de límites, `mes.seccion.conteo`).
   * Nodo opcional renderizado a la izquierda del pill contador (efecto "glyph").
   * undefined = sin marca, cero impacto (comportamiento idéntico a hoy).
   */
  countAdornment?: React.ReactNode;
  /** Clases extra para RECOLOREAR el pill contador (efecto "badge"). undefined = sin cambio. */
  countClassName?: string;
  /**
   * P2 — Fase 1 (marca visual pasiva de límites, `mes.seccion.subtotal`).
   * Nodo opcional renderizado a la izquierda del subtotal (efecto "glyph"/"badge"/"ring").
   */
  subtotalAdornment?: React.ReactNode;
  /** Clases extra sobre el propio texto del subtotal (efectos "bold"/"tint"/"ring"). */
  subtotalClassName?: string;
  /** Cuando true, omite la transición de altura del acordeón (colapso instantáneo).
   * Usado en modo orden para que las alturas sean estables antes del primer drag. */
  noTransition?: boolean;
  showGripHandle?: boolean;
  gripAttributes?: DraggableAttributes;
  gripListeners?: SyntheticListenerMap;
  /**
   * Slot de control de filtro — renderizado como HERMANO del <button> disclosure,
   * no como hijo (restricción de a11y: no anidar controles interactivos dentro
   * de un button). Se ubica a la derecha del <button> en la fila de cabecera.
   * No se renderiza cuando isOrderMode=true.
   */
  filterSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function AccordionSection({
  id,
  label,
  count,
  subtotal,
  isCollapsed,
  onToggle,
  isOrderMode,
  noTransition = false,
  showGripHandle = false,
  gripAttributes,
  gripListeners,
  filterSlot,
  countAdornment,
  countClassName,
  subtotalAdornment,
  subtotalClassName,
  children,
}: AccordionSectionProps) {
  const bodyId = `${id}-body`;

  return (
    <section aria-labelledby={id}>
      {/*
       * Fila de cabecera — contenedor flex que envuelve el <button> disclosure
       * y, a su derecha como sibling, el slot de filtro (filterSlot).
       *
       * RESTRICCIÓN DE A11Y: el disparador de filtro NO puede ser hijo del
       * <button> de disclosure (no se anidan controles interactivos en un button).
       * El flex-wrapper es solo un contenedor de layout, no tiene semántica propia.
       */}
      <div className="flex items-center gap-1 pb-[10px]">
        {/*
         * <button> de disclosure — ocupa todo el espacio disponible (flex-1).
         * En modo orden: no es accionable (cursor grab); el handle GripVertical
         * es el punto de arrastre. Fuera de modo orden: click colapsa/expande.
         */}
        <button
          type="button"
          id={id}
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          onClick={isOrderMode ? undefined : onToggle}
          className={[
            "flex-1 flex items-center gap-3 px-1 text-left min-w-0",
            "group/header",
            "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:rounded-[var(--r-chip)]",
            // Cursor según modo
            isOrderMode ? "cursor-grab" : "cursor-pointer",
            // Transición de color hover
            !isOrderMode ? "transition-colors duration-[140ms]" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Handle de drag — solo en modo orden */}
          {showGripHandle && (
            <span
              className="flex items-center text-muted touch-none"
              style={{ touchAction: "none" }}
              {...gripAttributes}
              {...gripListeners}
              aria-label="Arrastrar sección"
            >
              <GripVertical
                size={16}
                aria-hidden="true"
                className="cursor-grab active:cursor-grabbing"
              />
            </span>
          )}

          {/* Chevron de colapso — indicador de estado */}
          <ChevronRight
            size={16}
            aria-hidden="true"
            className={[
              // Color: muted en reposo, ink-2 en hover de la cabecera (fuera de modo orden)
              "shrink-0 transition-all duration-[220ms] ease-out",
              isOrderMode
                ? "text-muted"
                : "text-muted group-hover/header:text-ink-2",
              // Rotación: 90° = apunta ▼ (expandido); 0° = apunta ▶ (colapsado)
              isCollapsed ? "rotate-0" : "rotate-90",
              // prefers-reduced-motion: sin animación
              "motion-reduce:transition-none",
            ]
              .filter(Boolean)
              .join(" ")}
          />

          {/* Rótulo */}
          <span
            className={[
              "text-[13px] font-bold uppercase tracking-[0.1em]",
              // Color: ink-2 en reposo, ink en hover (fuera de modo orden)
              isOrderMode
                ? "text-ink-2"
                : "text-ink-2 transition-colors duration-[140ms] group-hover/header:text-ink",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </span>

          {/* Pill contador — countAdornment (glyph) / countClassName (badge, recolorea el pill) */}
          <span className="inline-flex items-center gap-[4px]">
            {countAdornment}
            <span
              className={cn(
                "text-[11.5px] font-semibold text-muted bg-panel-3 rounded-pill px-[9px] py-[1px]",
                countClassName,
              )}
            >
              {count}
            </span>
          </span>

          {/* Línea divisoria */}
          <span className="flex-1 h-px bg-hair" aria-hidden="true" />

          {/* Subtotal mono — subtotalAdornment (glyph/badge) + subtotalClassName (bold/tint/ring) */}
          <span className="inline-flex items-center gap-[6px]">
            {subtotalAdornment}
            <span className={cn("text-[13px] font-semibold text-muted mono", subtotalClassName)}>
              {subtotal}
            </span>
          </span>
        </button>

        {/* Slot de filtro — hermano del <button>, visible solo fuera del modo orden */}
        {!isOrderMode && filterSlot}
      </div>

      {/*
       * Cuerpo del acordeón — técnica CSS grid rows para animar height:auto.
       * grid-rows-[0fr] con overflow-hidden = altura 0 sin caja visible.
       * grid-rows-[1fr] = altura natural.
       * El <div> interior (min-h-0) es necesario para que el grid pueda comprimir.
       *
       * opacity 0→1 para fade del contenido.
       * prefers-reduced-motion: ambas transiciones omitidas (estado instantáneo).
       *
       * El role="region" lo provee el <section> padre vía aria-labelledby;
       * este div es solo el contenedor de animación (no tiene semántica de región propia).
       */}
      <div
        id={bodyId}
        className={[
          "grid motion-reduce:transition-none",
          // En modo orden (noTransition=true) el colapso es instantáneo: sin transición.
          // Esto garantiza que las alturas estén estables antes del primer drag y dnd-kit
          // no use medidas desactualizadas de las secciones expandidas (gotcha dnd-kit).
          noTransition
            ? ""
            : "transition-[grid-template-rows,opacity] duration-[220ms] ease-out",
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
}
