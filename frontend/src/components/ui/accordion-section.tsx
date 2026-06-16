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
 *   - children: cuerpo de la sección (tarjeta-lista o empty inline).
 */

import { ChevronRight, GripVertical } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

interface AccordionSectionProps {
  id: string;
  label: string;
  count: number;
  subtotal: string;
  isCollapsed: boolean;
  onToggle: () => void;
  isOrderMode: boolean;
  showGripHandle?: boolean;
  gripAttributes?: DraggableAttributes;
  gripListeners?: SyntheticListenerMap;
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
  showGripHandle = false,
  gripAttributes,
  gripListeners,
  children,
}: AccordionSectionProps) {
  const bodyId = `${id}-body`;

  return (
    <section aria-labelledby={id}>
      {/*
       * Cabecera — disclosure trigger.
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
          "w-full flex items-center gap-3 px-1 pb-[10px] text-left",
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

        {/* Pill contador */}
        <span className="text-[11.5px] font-semibold text-muted bg-panel-3 rounded-pill px-[9px] py-[1px]">
          {count}
        </span>

        {/* Línea divisoria */}
        <span className="flex-1 h-px bg-hair" aria-hidden="true" />

        {/* Subtotal mono */}
        <span className="text-[13px] font-semibold text-muted mono">
          {subtotal}
        </span>
      </button>

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
          "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none",
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        ].join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
}
