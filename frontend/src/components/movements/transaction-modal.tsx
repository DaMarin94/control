"use client";

/**
 * Modal de movimiento (RF-CM-001 / RF-MU-001/002 / RF-MF-001/003).
 *
 * ── Modo crear (mode === "create") ──
 *   Muestra 3 tabs: Único (funcional), Fijo (funcional desde Fase 6),
 *   Cuotas (deshabilitado, "Próximamente").
 *   Tab Único activo por defecto.
 *
 * ── Modo editar único (mode === "edit-single") ──
 *   Sin tabs; abre el TransactionForm precargado con el movimiento único.
 *
 * ── Modo editar fijo (mode === "edit-fixed") ──
 *   Sin tabs; abre el RecurringForm precargado con el fijo.
 *
 * El modal se superpone (no tiene ruta propia).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/movements/transaction-form";
import { RecurringForm } from "@/components/movements/recurring-form";
import { type Transaction } from "@/types/transaction";
import { type Recurring } from "@/types/recurring";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = "single" | "fixed" | "installments";

interface Tab {
  id: TabId;
  label: string;
  comingSoon: boolean;
}

const TABS: Tab[] = [
  { id: "single", label: "Único", comingSoon: false },
  { id: "fixed", label: "Fijo", comingSoon: false },
  { id: "installments", label: "Cuotas", comingSoon: true },
];

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Tres modos de uso:
 *
 * 1. Crear → mode="create", transaction=null, recurring=null
 *    Muestra tabs; el usuario elige el tipo.
 *
 * 2. Editar único → mode="edit-single", transaction=Transaction, recurring=null
 *    Sin tabs; abre TransactionForm precargado.
 *
 * 3. Editar fijo → mode="edit-fixed", transaction=null, recurring=Recurring
 *    Sin tabs; abre RecurringForm precargado.
 */
export type TransactionModalProps =
  | {
      mode: "create";
      transaction?: null;
      recurring?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-single";
      transaction: Transaction;
      recurring?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-fixed";
      transaction?: null;
      recurring: Recurring;
      onClose: () => void;
    };

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionModal(props: TransactionModalProps) {
  const { mode, onClose } = props;
  const isEditing = mode !== "create";

  const [activeTab, setActiveTab] = useState<TabId>("single");

  // Título del modal
  const title = isEditing ? "Editar movimiento" : "Nuevo movimiento";

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
            {title}
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

        {/* ── Contenido ── */}
        {isEditing ? (
          /* Modo edición — sin tabs */
          <div>
            {mode === "edit-single" ? (
              <TransactionForm transaction={props.transaction} onClose={onClose} />
            ) : (
              /* mode === "edit-fixed" */
              <RecurringForm recurring={props.recurring} onClose={onClose} />
            )}
          </div>
        ) : (
          /* Modo creación — con tabs */
          <>
            {activeTab === "single" && (
              <div
                id="tab-panel-single"
                role="tabpanel"
                aria-labelledby="tab-single"
              >
                <TransactionForm transaction={null} onClose={onClose} />
              </div>
            )}
            {activeTab === "fixed" && (
              <div
                id="tab-panel-fixed"
                role="tabpanel"
                aria-labelledby="tab-fixed"
              >
                <RecurringForm recurring={null} onClose={onClose} />
              </div>
            )}
            {activeTab === "installments" && (
              /* No debería ser seleccionable (disabled), pero por si acaso */
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                Próximamente disponible.
              </div>
            )}
          </>
        )}

        {/* Botón cancelar de fallback para el tab deshabilitado (Cuotas) */}
        {!isEditing && activeTab === "installments" && (
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
