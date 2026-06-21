"use client";

/**
 * Modal de movimiento (RF-CM-001 / RF-MU-001/002 / RF-MF-001/003 / RF-MC-001/003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Scrim: fijo, ink/0.46 + blur(3px)
 * - Diálogo: max-width 440px, radio 18px, shadow-lg, animación modal-pop
 * - Tabs .dtabs: Único / Fijo / Cuotas (solo en creación), fondo panel-3, activo blanco + shadow-sm
 * - Cierra con X, click en scrim, o Esc
 *
 * Lógica de tabs, mode, y contenido preservada intacta.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionForm } from "@/components/movements/transaction-form";
import { RecurringForm } from "@/components/movements/recurring-form";
import { InstallmentForm } from "@/components/movements/installment-form";
import { CalculatedForm } from "@/components/movements/calculated-form";
import { type Transaction } from "@/types/transaction";
import { type Recurring } from "@/types/recurring";
import { type InstallmentGroup } from "@/types/installment";
import { type MovementItem } from "@/types/movement";

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

export type TransactionModalProps =
  | {
      mode: "create";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated?: null;
      onClose: () => void;
      defaultMonth?: string;
    }
  | {
      mode: "edit-single";
      transaction: Transaction;
      recurring?: null;
      installment?: null;
      calculated?: null;
      onClose: () => void;
    }
  | {
      mode: "edit-fixed";
      transaction?: null;
      recurring: Recurring;
      installment?: null;
      calculated?: null;
      onClose: () => void;
      viewMonth?: string;
    }
  | {
      mode: "edit-installment";
      transaction?: null;
      recurring?: null;
      installment: InstallmentGroup;
      calculated?: null;
      onClose: () => void;
    }
  | {
      /**
       * Crear un movimiento calculado derivado de un fijo de origen.
       * `calculated` es el MovementItem del fijo ORIGEN (desde el que se crea).
       */
      mode: "create-calculated";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated: MovementItem;
      onClose: () => void;
      viewMonth?: string;
    }
  | {
      /**
       * Editar un movimiento calculado existente.
       * `calculated` es el MovementItem del calculado (ya es un fijo calculado).
       */
      mode: "edit-calculated";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated: MovementItem;
      onClose: () => void;
      viewMonth?: string;
    };

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionModal(props: TransactionModalProps) {
  const { mode, onClose } = props;
  const isEditing = mode !== "create";
  const isCalculatedMode = mode === "create-calculated" || mode === "edit-calculated";
  const defaultMonth = mode === "create" ? props.defaultMonth : undefined;

  const [activeTab, setActiveTab] = useState<TabId>("single");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Título del modal
  let title = "Nuevo movimiento";
  if (mode === "edit-single") title = "Editar movimiento";
  else if (mode === "edit-fixed") title = "Editar · Fijo";
  else if (mode === "edit-installment") title = "Editar · Cuotas";
  else if (mode === "create-calculated") title = "Nuevo movimiento calculado";
  else if (mode === "edit-calculated") title = "Editar movimiento calculado";

  if (!mounted) return null;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[440px] bg-panel border border-line overflow-hidden animate-modal-pop"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-[22px] pt-5 pb-4">
          <h2
            id="transaction-modal-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* ── Tabs .dtabs (solo en modo crear normal, no en calculado) ── */}
        {!isEditing && !isCalculatedMode && (
          <div
            className="flex gap-1 mx-[22px] mb-4 p-1 rounded-ctl bg-panel-3"
            role="tablist"
            aria-label="Tipo de movimiento"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
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
        )}

        {/* ── Contenido ── */}
        {isCalculatedMode ? (
          /* Modos de calculado: create-calculated / edit-calculated */
          <CalculatedForm
            mode={mode === "edit-calculated" ? "edit" : "create"}
            movement={props.calculated}
            onClose={onClose}
            viewMonth={
              mode === "create-calculated" || mode === "edit-calculated"
                ? props.viewMonth
                : undefined
            }
          />
        ) : isEditing ? (
          <div>
            {mode === "edit-single" ? (
              <TransactionForm transaction={props.transaction} onClose={onClose} />
            ) : mode === "edit-fixed" ? (
              <RecurringForm
                recurring={props.recurring}
                onClose={onClose}
                viewMonth={props.viewMonth}
              />
            ) : (
              <InstallmentForm installment={props.installment} onClose={onClose} />
            )}
          </div>
        ) : (
          <>
            {activeTab === "single" && (
              <div id="tab-panel-single" role="tabpanel" aria-labelledby="tab-single">
                <TransactionForm transaction={null} onClose={onClose} />
              </div>
            )}
            {activeTab === "fixed" && (
              <div id="tab-panel-fixed" role="tabpanel" aria-labelledby="tab-fixed">
                <RecurringForm recurring={null} onClose={onClose} defaultMonth={defaultMonth} />
              </div>
            )}
            {activeTab === "installments" && (
              <div
                id="tab-panel-installments"
                role="tabpanel"
                aria-labelledby="tab-installments"
              >
                <InstallmentForm
                  installment={null}
                  onClose={onClose}
                  defaultMonth={defaultMonth}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
