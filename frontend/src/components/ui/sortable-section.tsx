"use client";

/**
 * SortableSection — Wrapper de sección reordenable con dnd-kit (Fase 1.1.4).
 *
 * Envuelve un AccordionSection con la lógica de `useSortable` de @dnd-kit/sortable.
 * Cuando el modo orden está activo, la sección se puede arrastrar.
 *
 * El overlay del ítem levantado (DragOverlay) se renderiza en el padre (MonthViewClient)
 * para poder portalarlo fuera del contexto de transformación si es necesario.
 *
 * Props:
 *   - id: identificador único de la sección sortable.
 *   - isOrderMode: true cuando está en modo orden (activa el drag).
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
  children,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    // Solo sortable cuando está en modo orden
    disabled: !isOrderMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // El ítem levantado queda invisible en su posición original
    // (el DragOverlay lo muestra en su lugar)
    opacity: isDragging ? 0 : 1,
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
        showGripHandle={isOrderMode}
        gripAttributes={attributes}
        gripListeners={listeners}
      >
        {children}
      </AccordionSection>
    </div>
  );
}
