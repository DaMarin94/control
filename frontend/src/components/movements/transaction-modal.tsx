"use client";

/**
 * Modal de movimiento (RF-CM-001 / RF-MU-001 / RF-MU-002).
 *
 * Modo crear (transaction = null):
 *   Muestra 3 tabs: Único (funcional), Fijo y Cuotas (deshabilitados, "Próximamente").
 *
 * Modo editar (transaction = Transaction):
 *   Sin tabs, abre directamente el formulario del movimiento con campos precargados.
 *
 * El modal se superpone (no tiene ruta propia).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/movements/transaction-form";
import { type Transaction } from "@/types/transaction";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = "single" | "fixed" | "installments";

interface Tab {
  id: TabId;
  label: string;
  comingSoon: boolean;
}

const TABS: Tab[] = [
  { id: "single", label: "Único", comingSoon: false },
  { id: "fixed", label: "Fijo", comingSoon: true },
  { id: "installments", label: "Cuotas", comingSoon: true },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransactionModalProps {
  /** null = modo crear; Transaction = modo editar */
  transaction: Transaction | null;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionModal({ transaction, onClose }: TransactionModalProps) {
  const isEditing = transaction !== null;
  const [activeTab, setActiveTab] = useState<TabId>("single");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-card shadow-lg">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="transaction-modal-title" className="text-lg font-semibold">
            {isEditing ? "Editar movimiento" : "Nuevo movimiento"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Tabs (solo en modo crear) ── */}
        {!isEditing && (
          <div className="flex border-b" role="tablist" aria-label="Tipo de movimiento">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-panel-${tab.id}`}
                disabled={tab.comingSoon}
                onClick={() => {
                  if (!tab.comingSoon) setActiveTab(tab.id);
                }}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  tab.comingSoon
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : activeTab === tab.id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.comingSoon && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Próximamente
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Contenido del tab activo ── */}
        {!isEditing && activeTab !== "single" ? (
          // Tabs deshabilitados — no deberían ser seleccionables, pero por si acaso
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Próximamente disponible.
          </div>
        ) : (
          <div
            id={!isEditing ? "tab-panel-single" : undefined}
            role={!isEditing ? "tabpanel" : undefined}
            aria-labelledby={!isEditing ? "tab-single" : undefined}
          >
            <TransactionForm transaction={transaction} onClose={onClose} />
          </div>
        )}

        {/* Botón cancelar de fallback para tabs deshabilitados activos (no debería ocurrir) */}
        {!isEditing && activeTab !== "single" && (
          <div className="flex justify-end border-t px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
