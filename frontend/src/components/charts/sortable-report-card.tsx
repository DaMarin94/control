"use client";

/**
 * SortableReportCard — Wrapper de card de reporte reordenable con dnd-kit (Ola 2, P1).
 *
 * Cuando isOrderMode=false: renderiza el <ReportCard> completo.
 * Cuando isOrderMode=true: colapsa la card a un mini-ítem arrastrable.
 *
 * El mini-ítem es puramente visual y transitorio: no persiste ninguna preferencia.
 * Estructura del mini:
 *   [grip GripVertical] · [ícono tipo] · [título / placeholder] · [divisor] · [etiqueta tipo]
 *
 * Drag in-place (sin DragOverlay): el ítem activo se traslada in-place con feedback
 * de elevación (--shadow-md), fondo (--panel), radio (--r-ctl) y cursor grabbing.
 * Las demás minis se desplazan para abrir el hueco — el desplazamiento ES la indicación.
 *
 * Spec visual: docs/design.md → "Reportes reordenables — modo orden de cards (Ola 2, P1)"
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, AreaChart, BarChart3 } from "lucide-react";
import { ReportCard } from "@/components/charts/report-card";
import type { ReportCardConfig, ReportCardType } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";

// ─── Mini-ítem ────────────────────────────────────────────────────────────────

interface ReportCardMiniProps {
  type: ReportCardType;
  title: string | undefined;
  titlePlaceholder: string;
  gripAttributes: ReturnType<typeof useSortable>["attributes"];
  gripListeners: ReturnType<typeof useSortable>["listeners"];
}

function ReportCardMini({
  type,
  title,
  titlePlaceholder,
  gripAttributes,
  gripListeners,
}: ReportCardMiniProps) {
  const TypeIcon = type === "income-expense" ? AreaChart : BarChart3;
  const typeLabel =
    type === "income-expense" ? "Ingresos y gastos" : "Por categoría";

  const hasTitle = Boolean(title);

  return (
    <div
      className="flex items-center gap-3 px-[var(--card-pad)] py-[14px]"
      style={{ minHeight: 56 }}
    >
      {/* Grip — punto de arrastre */}
      <span
        className="flex items-center text-muted touch-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        aria-label="Arrastrar reporte"
        {...gripAttributes}
        {...gripListeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </span>

      {/* Ícono de tipo */}
      <TypeIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />

      {/* Título o placeholder */}
      <span
        className={[
          "text-[16px] font-semibold leading-tight truncate min-w-0",
          hasTitle ? "text-ink" : "text-faint",
        ].join(" ")}
        title={hasTitle ? title : titlePlaceholder}
      >
        {hasTitle ? title : titlePlaceholder}
      </span>

      {/* Divisor flex */}
      <span className="flex-1 h-px bg-hair shrink-0" aria-hidden="true" />

      {/* Etiqueta de tipo */}
      <span className="text-[12px] font-semibold text-muted shrink-0 whitespace-nowrap">
        {typeLabel}
      </span>
    </div>
  );
}

// ─── Wrapper sortable ─────────────────────────────────────────────────────────

interface SortableReportCardProps {
  /** Config de la card (id, type, year, etc.) */
  config: ReportCardConfig;
  /** Índice 1-based para el placeholder "Reporte N" */
  index: number;
  /** Modo orden activo */
  isOrderMode: boolean;
  /** true cuando esta card es la que se arrastra activamente */
  isActive: boolean;
  // Props que pasan al ReportCard completo
  onYearChange: (year: number) => void;
  onCategoryIdsChange: (ids: string[] | null) => void;
  onCategoryBreakdownChange: (v: boolean) => void;
  onHiddenSeriesChange: (hidden: Array<"income" | "expense">) => void;
  onRemove: () => void;
  onCurrencyChange: (c: CurrencyCode) => void;
  onTitleChange: (t: string) => void;
}

export function SortableReportCard({
  config,
  index,
  isOrderMode,
  isActive,
  onYearChange,
  onCategoryIdsChange,
  onCategoryBreakdownChange,
  onHiddenSeriesChange,
  onRemove,
  onCurrencyChange,
  onTitleChange,
}: SortableReportCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: config.id,
    disabled: !isOrderMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // En modo orden: colapso instantáneo (noTransition). Fuera: transición normal de dnd-kit.
    transition: isOrderMode ? transition : undefined,
    // Feedback del ítem activo (igual que SortableSection)
    ...(isActive && {
      boxShadow: "var(--shadow-md)",
      background: "var(--panel)",
      borderRadius: "var(--r-ctl)",
      cursor: "grabbing",
      padding: "10px",
    }),
  };

  const titlePlaceholder = `Reporte ${index}`;

  return (
    <div ref={setNodeRef} style={style}>
      {isOrderMode ? (
        // Mini-ítem: superficie de card compactada, no sortable al clic
        <div className="bg-panel border border-line rounded-card overflow-hidden">
          <ReportCardMini
            type={config.type}
            title={config.title}
            titlePlaceholder={titlePlaceholder}
            gripAttributes={attributes}
            gripListeners={listeners}
          />
        </div>
      ) : (
        <ReportCard
          type={config.type}
          year={config.year}
          categoryIds={config.categoryIds}
          categoryBreakdown={config.categoryBreakdown ?? false}
          hiddenSeries={config.hiddenSeries ?? []}
          chartHeight={300}
          onYearChange={onYearChange}
          onCategoryIdsChange={onCategoryIdsChange}
          onCategoryBreakdownChange={onCategoryBreakdownChange}
          onHiddenSeriesChange={onHiddenSeriesChange}
          removable={true}
          onRemove={onRemove}
          currency={config.currency}
          onCurrencyChange={onCurrencyChange}
          title={config.title}
          titlePlaceholder={titlePlaceholder}
          onTitleChange={onTitleChange}
        />
      )}
    </div>
  );
}
