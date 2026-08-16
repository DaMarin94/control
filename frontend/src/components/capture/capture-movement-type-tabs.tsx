"use client";

/**
 * CaptureMovementTypeTabs — barra de tabs Único / Fijo / Cuotas de la
 * SUPERFICIE DE CAPTURA (docs/design.md §Superficie de captura → "6.
 * Cabecera B — barra de tabs"). Composición hermana de `MovementTypeTabs`
 * (movements/movement-type-tabs.tsx, usada por el modal de escritorio):
 * mismo molde `.dtabs`, misma semántica ARIA (`role="tablist"`/`"tab"`,
 * `aria-selected`), densidad y ancho propios (texto 14px/600, `py-[13px]`,
 * ancho completo de la columna de contenido — sin el `mx-[22px]` que el
 * modal usa para alinearse a su gutter interno, acá el padding ya lo da la
 * Zona 1 del envase).
 */

import { cn } from "@/lib/utils";
import type { MovementTabId } from "@/components/movements/movement-type-tabs";

export type { MovementTabId };

interface Tab {
  id: MovementTabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "single", label: "Único" },
  { id: "fixed", label: "Fijo" },
  { id: "installments", label: "Cuotas" },
];

export interface CaptureMovementTypeTabsProps {
  activeTab: MovementTabId;
  onTabChange: (tab: MovementTabId) => void;
}

export function CaptureMovementTypeTabs({ activeTab, onTabChange }: CaptureMovementTypeTabsProps) {
  return (
    <div
      className="flex gap-1 p-1 rounded-ctl bg-panel-3"
      role="tablist"
      aria-label="Tipo de movimiento"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`tab-panel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 text-[14px] font-semibold cursor-pointer px-2 py-[13px] rounded-[7px]",
            "transition-colors duration-[140ms]",
            "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
            activeTab === tab.id
              ? "bg-panel text-ink shadow-[var(--shadow-sm)]"
              : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
