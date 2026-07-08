"use client";

/**
 * ConfiguracionTabs — /configuracion pasa a solapas (docs/design.md
 * §"Panel de gestión de límites" → 1. "Ubicación e integración — /configuracion
 * pasa a solapas"). Dos solapas hermanas bajo la misma cabecera `.phead`:
 * "General" (la card de Moneda por defecto, intacta — `SettingsClient`) y
 * "Límites" (el gestor de límites — `LimitsTab`).
 *
 * Chrome de la solapa: reusa el segmented `.dtabs` (mismo molde del selector
 * Ingreso/Gasto/Transferencia del modal de movimiento) — ancho al contenido,
 * NO full-width, alineado a la izquierda, debajo de `.phead` (mb-6).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SettingsClient } from "@/app/(app)/configuracion/settings-client";
import { LimitsTab } from "@/components/limits/limits-tab";

type TabId = "general" | "limites";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "limites", label: "Límites" },
];

export function ConfiguracionTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div>
      {/* Segmented .dtabs — ancho al contenido, alineado a la izquierda */}
      <div
        className="inline-flex gap-1 p-1 rounded-ctl bg-panel-3 mb-6"
        role="tablist"
        aria-label="Solapas de configuración"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`configuracion-tabpanel-${tab.id}`}
            id={`configuracion-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "text-[13.5px] font-semibold cursor-pointer px-3 py-[9px] rounded-[7px]",
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

      <div
        id="configuracion-tabpanel-general"
        role="tabpanel"
        aria-labelledby="configuracion-tab-general"
        hidden={activeTab !== "general"}
      >
        {activeTab === "general" && <SettingsClient />}
      </div>

      <div
        id="configuracion-tabpanel-limites"
        role="tabpanel"
        aria-labelledby="configuracion-tab-limites"
        hidden={activeTab !== "limites"}
      >
        {activeTab === "limites" && <LimitsTab />}
      </div>
    </div>
  );
}
