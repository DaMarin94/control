"use client";

/**
 * Modal de movimiento (RF-CM-001 / RF-MU-001/002 / RF-MF-001/003 / RF-MC-001/003).
 *
 * ── Modo crear (mode === "create") ──
 *   Muestra 3 tabs: Único (funcional), Fijo (funcional desde Fase 6),
 *   Cuotas (funcional desde Fase 7).
 *   Tab Único activo por defecto.
 *
 * ── Modo editar único (mode === "edit-single") ──
 *   Sin tabs; abre el TransactionForm precargado con el movimiento único.
 *
 * ── Modo editar fijo (mode === "edit-fixed") ──
 *   Sin tabs; abre el RecurringForm precargado con el fijo.
 *
 * ── Modo editar cuotas (mode === "edit-installment") ──
 *   Sin tabs; abre el InstallmentForm precargado con el grupo de cuotas.
 *
 * El modal se superpone (no tiene ruta propia).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TransactionForm } from "@/components/movements/transaction-form";
import { RecurringForm } from "@/components/movements/recurring-form";
import { InstallmentForm } from "@/components/movements/installment-form";
import { type Transaction } from "@/types/transaction";
import { type Recurring } from "@/types/recurring";
import { type InstallmentGroup } from "@/types/installment";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = "single" | "fixed" | "installments";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "single", label: "Único" },
  { id: "fixed", label: "Fijo" },
  { id: "installments", label: "Cuotas" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Cuatro modos de uso:
 *
 * 1. Crear → mode="create"
 *    Muestra los 3 tabs (Único, Fijo, Cuotas); el usuario elige el tipo.
 *
 * 2. Editar único → mode="edit-single", transaction=Transaction
 *    Sin tabs; abre TransactionForm precargado.
 *
 * 3. Editar fijo → mode="edit-fixed", recurring=Recurring
 *    Sin tabs; abre RecurringForm precargado.
 *
 * 4. Editar cuotas → mode="edit-installment", installment=InstallmentGroup
 *    Sin tabs; abre InstallmentForm precargado.
 */
export type TransactionModalProps =
  | {
      mode: "create";
      transaction?: null;
      recurring?: null;
      installment?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-single";
      transaction: Transaction;
      recurring?: null;
      installment?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-fixed";
      transaction?: null;
      recurring: Recurring;
      installment?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-installment";
      transaction?: null;
      recurring?: null;
      installment: InstallmentGroup;
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
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  activeTab === tab.id
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
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
            ) : mode === "edit-fixed" ? (
              <RecurringForm recurring={props.recurring} onClose={onClose} />
            ) : (
              /* mode === "edit-installment" */
              <InstallmentForm installment={props.installment} onClose={onClose} />
            )}
          </div>
        ) : (
          /* Modo creación — con tabs */
          <>
            {activeTab === "single" && (
              <div id="tab-panel-single" role="tabpanel" aria-labelledby="tab-single">
                <TransactionForm transaction={null} onClose={onClose} />
              </div>
            )}
            {activeTab === "fixed" && (
              <div id="tab-panel-fixed" role="tabpanel" aria-labelledby="tab-fixed">
                <RecurringForm recurring={null} onClose={onClose} />
              </div>
            )}
            {activeTab === "installments" && (
              <div id="tab-panel-installments" role="tabpanel" aria-labelledby="tab-installments">
                <InstallmentForm installment={null} onClose={onClose} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
