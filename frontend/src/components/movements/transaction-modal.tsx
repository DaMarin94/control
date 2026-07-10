"use client";

/**
 * Modal de movimiento (RF-CM-001 / RF-MU-001/002 / RF-MF-001/003 / RF-MC-001/003).
 *
 * Consume el shell compartido `ModalShell` (variant="form", docs/design.md
 * §"Shell de modal compartido") — scrim, panel, max-height y body-lock viven
 * ahí; este componente solo aporta header (título + tabs) y el form activo.
 * - Tabs .dtabs: Único / Fijo / Cuotas (solo en creación), fondo panel-3, activo blanco + shadow-sm
 * - Cierra con X o Esc (el click en el scrim NO cierra — decisión explícita)
 *
 * Lógica de tabs, mode, y contenido preservada intacta.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ModalShell, ModalShellHeader } from "@/components/ui/modal-shell";
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
      /** true si el movimiento está ACTUALMENTE anulado — alimenta D16 (Límites, Fase 2). */
      editingSkipped?: boolean;
    }
  | {
      mode: "edit-fixed";
      transaction?: null;
      recurring: Recurring;
      installment?: null;
      calculated?: null;
      onClose: () => void;
      viewMonth?: string;
      /** true si el fijo está ACTUALMENTE anulado para el mes visualizado — alimenta D16 (Límites, Fase 2). */
      editingSkipped?: boolean;
    }
  | {
      mode: "edit-installment";
      transaction?: null;
      recurring?: null;
      installment: InstallmentGroup;
      calculated?: null;
      onClose: () => void;
      /** true si la cuota está ACTUALMENTE anulada para el mes visualizado — alimenta D16 (Límites, Fase 2). */
      editingSkipped?: boolean;
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

  // Título del modal
  let title = "Nuevo movimiento";
  if (mode === "edit-single") title = "Editar movimiento";
  else if (mode === "edit-fixed") title = "Editar · Fijo";
  else if (mode === "edit-installment") title = "Editar · Cuotas";
  else if (mode === "create-calculated") title = "Nuevo movimiento calculado";
  else if (mode === "edit-calculated") title = "Editar movimiento calculado";

  return (
    <ModalShell variant="form" onClose={onClose} labelledBy="transaction-modal-title">
      {/* ── Header ── */}
      <ModalShellHeader titleId="transaction-modal-title" title={title} onClose={onClose} />

      {/* ── Tabs .dtabs (solo en modo crear normal, no en calculado) ── */}
      {!isEditing && !isCalculatedMode && (
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

      {/* ── Contenido — flex-1/min-h-0: el form activo (su propio <form> es
          flex-col) se lleva el alto restante y scrollea su cuerpo, con el
          footer de acciones pineado dentro de cada form (hermano del
          cuerpo scrolleable, no hijo de él). ── */}
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
        <div className="flex-1 min-h-0 flex flex-col">
          {mode === "edit-single" ? (
            <TransactionForm
              transaction={props.transaction}
              onClose={onClose}
              editingSkipped={props.editingSkipped}
            />
          ) : mode === "edit-fixed" ? (
            <RecurringForm
              recurring={props.recurring}
              onClose={onClose}
              viewMonth={props.viewMonth}
              editingSkipped={props.editingSkipped}
            />
          ) : (
            <InstallmentForm
              installment={props.installment}
              onClose={onClose}
              editingSkipped={props.editingSkipped}
            />
          )}
        </div>
      ) : (
        <>
          {activeTab === "single" && (
            <div
              id="tab-panel-single"
              role="tabpanel"
              aria-labelledby="tab-single"
              className="flex-1 min-h-0 flex flex-col"
            >
              <TransactionForm transaction={null} onClose={onClose} />
            </div>
          )}
          {activeTab === "fixed" && (
            <div
              id="tab-panel-fixed"
              role="tabpanel"
              aria-labelledby="tab-fixed"
              className="flex-1 min-h-0 flex flex-col"
            >
              <RecurringForm recurring={null} onClose={onClose} defaultMonth={defaultMonth} />
            </div>
          )}
          {activeTab === "installments" && (
            <div
              id="tab-panel-installments"
              role="tabpanel"
              aria-labelledby="tab-installments"
              className="flex-1 min-h-0 flex flex-col"
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
    </ModalShell>
  );
}
