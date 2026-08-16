"use client";

/**
 * MovementTypeTabs — barra de tabs Único / Fijo / Cuotas del modal de
 * ESCRITORIO (`TransactionModal`), docs/design.md §Superficie de captura →
 * "0. Encuadre — una lógica, dos composiciones". La superficie de captura
 * tiene su propia composición hermana con su propia densidad (§6, texto
 * 14px/600, py-[13px], ancho de columna) — `CaptureMovementTypeTabs`
 * (components/capture/) — en vez de reusar esta pieza con overrides de CSS:
 * el modelo de capas descarta la cascada como mecanismo de densidad.
 */

import { cn } from "@/lib/utils";

export type MovementTabId = "single" | "fixed" | "installments";

interface Tab {
  id: MovementTabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "single", label: "Único" },
  { id: "fixed", label: "Fijo" },
  { id: "installments", label: "Cuotas" },
];

export interface MovementTypeTabsProps {
  activeTab: MovementTabId;
  onTabChange: (tab: MovementTabId) => void;
}

export function MovementTypeTabs({ activeTab, onTabChange }: MovementTypeTabsProps) {
  return (
    <div
      className="flex gap-1 mx-[22px] mb-4 p-1 rounded-ctl bg-panel-3 shrink-0"
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
            "flex-1 text-[13.5px] font-semibold cursor-pointer px-2 py-[9px] rounded-[7px]",
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
