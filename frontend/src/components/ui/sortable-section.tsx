"use client";

/**
 * SortableSection — Wrapper de sección reordenable con dnd-kit (Fase 1.1.4).
 *
 * Envuelve un AccordionSection con la lógica de `useSortable` de @dnd-kit/sortable.
 * Cuando el modo orden está activo, la sección se puede arrastrar.
 *
 * Drag in-place (Fase 1.2.0):
 *   - Sin DragOverlay: el ítem activo se desliza in-place (no flota).
 *   - opacity: 1 siempre (el original no se atenúa, ya no hay clon flotante).
 *   - El feedback visual del ítem activo (elevación, fondo, radio, cursor grabbing)
 *     se aplica sobre la propia cabecera cuando isActive=true.
 *   - Los modifiers restrictToVerticalAxis + restrictToParentElement se configuran
 *     en el DndContext padre (MonthViewClient).
 *
 * Props:
 *   - id: identificador único de la sección sortable.
 *   - isOrderMode: true cuando está en modo orden (activa el drag).
 *   - isActive: true cuando esta sección es la que se está arrastrando.
 *   - Resto de props se pasan a AccordionSection.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AccordionSection } from "@/components/ui/accordion-section";

interface SortableSectionProps {
  id: string;
  label: string;
  count: number;
  subtotal: string;
  isCollapsed: boolean;
  onToggle: () => void;
  isOrderMode: boolean;
  /** true cuando esta sección es la que se está arrastrando activamente */
  isActive?: boolean;
  children: React.ReactNode;
}

export function SortableSection({
  id,
  label,
  count,
  subtotal,
  isCollapsed,
  onToggle,
  isOrderMode,
  isActive = false,
  children,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    // Solo sortable cuando está en modo orden
    disabled: !isOrderMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    // Drag in-place (Fase 1.2.0): el ítem permanece visible (opacity 1 siempre).
    // Feedback visual del ítem activo: elevación + fondo + radio (sin scale).
    ...(isActive && {
      boxShadow: "var(--shadow-md)",
      background: "var(--panel)",
      borderRadius: "var(--r-ctl)",
      cursor: "grabbing",
      padding: "10px",
    }),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AccordionSection
        id={id}
        label={label}
        count={count}
        subtotal={subtotal}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        isOrderMode={isOrderMode}
        // En modo orden: colapso instantáneo (sin animación de altura) para que
        // dnd-kit mida rects estables desde el primer frame del drag.
        noTransition={isOrderMode}
        showGripHandle={isOrderMode}
        gripAttributes={attributes}
        gripListeners={listeners}
      >
        {children}
      </AccordionSection>
    </div>
  );
}
