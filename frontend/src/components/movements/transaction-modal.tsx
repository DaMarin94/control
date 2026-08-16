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
 * Footer como slot del ENVASE (docs/design.md §Superficie de captura →
 * "0. Encuadre"): ninguno de los tres forms (Único/Fijo/Cuotas) dibuja su
 * propio footer — el estado se reporta desde la capa de lógica
 * (`use*FormLogic`, `movement-form-footer.ts`). Este componente es el
 * ENVASE de escritorio: dibuja Cancelar+Guardar en `ModalShellFooter`,
 * asociando el botón al `<form>` activo vía `form={footerState.formId}`
 * (asociación nativa de HTML — el botón no es descendiente del `<form>`).
 * El envase de la superficie de captura (`CaptureShell`) usa el mismo
 * mecanismo con su propia composición (solo Guardar, ancho completo).
 *
 * Lógica de tabs, mode, y contenido preservada intacta.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellFooter } from "@/components/ui/modal-shell";
import { MovementTypeTabs, type MovementTabId } from "@/components/movements/movement-type-tabs";
import { MovementCaptureForms } from "@/components/movements/movement-capture-forms";
import { TransactionForm, type TransactionPrefill } from "@/components/movements/transaction-form";
import { RecurringForm, type RecurringPrefill } from "@/components/movements/recurring-form";
import { InstallmentForm, type InstallmentPrefill } from "@/components/movements/installment-form";
import { CalculatedForm } from "@/components/movements/calculated-form";
import {
  DEFAULT_MOVEMENT_FORM_FOOTER_STATE,
  type MovementFormFooterState,
} from "@/components/movements/movement-form-footer";
import { type Transaction } from "@/types/transaction";
import { type Recurring } from "@/types/recurring";
import { type InstallmentGroup } from "@/types/installment";
import { type MovementItem } from "@/types/movement";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = MovementTabId;

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
    }
  | {
      /**
       * "Duplicar movimiento" (docs/design.md) — crea (POST) un único NUEVO
       * precargado con los valores de un único origen. Tabs ocultos, igual
       * que en edición.
       */
      mode: "duplicate-single";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated?: null;
      transactionPrefill: TransactionPrefill;
      onClose: () => void;
    }
  | {
      /** "Duplicar movimiento" para un fijo origen — crea (POST) un fijo nuevo. */
      mode: "duplicate-fixed";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated?: null;
      recurringPrefill: RecurringPrefill;
      onClose: () => void;
      viewMonth?: string;
    }
  | {
      /** "Duplicar movimiento" para una cuota origen — crea (POST) un grupo de cuotas nuevo. */
      mode: "duplicate-installment";
      transaction?: null;
      recurring?: null;
      installment?: null;
      calculated?: null;
      installmentPrefill: InstallmentPrefill;
      onClose: () => void;
    };

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionModal(props: TransactionModalProps) {
  const { mode, onClose } = props;
  const isEditing = mode !== "create";
  const isCalculatedMode = mode === "create-calculated" || mode === "edit-calculated";
  const defaultMonth = mode === "create" ? props.defaultMonth : undefined;

  const [activeTab, setActiveTab] = useState<TabId>("single");
  const [footerState, setFooterState] = useState<MovementFormFooterState>(
    DEFAULT_MOVEMENT_FORM_FOOTER_STATE,
  );

  // Título del modal
  let title = "Nuevo movimiento";
  if (mode === "edit-single") title = "Editar movimiento";
  else if (mode === "edit-fixed") title = "Editar · Fijo";
  else if (mode === "edit-installment") title = "Editar · Cuotas";
  else if (mode === "create-calculated") title = "Nuevo movimiento calculado";
  else if (mode === "edit-calculated") title = "Editar movimiento calculado";
  // "Duplicar" — espeja la gramática de edición, no la de creación (docs/design.md).
  else if (mode === "duplicate-single") title = "Duplicar movimiento";
  else if (mode === "duplicate-fixed") title = "Duplicar · Fijo";
  else if (mode === "duplicate-installment") title = "Duplicar · Cuotas";

  return (
    <ModalShell variant="form" onClose={onClose} labelledBy="transaction-modal-title">
      {/* ── Header ── */}
      <ModalShellHeader titleId="transaction-modal-title" title={title} onClose={onClose} />

      {/* ── Tabs .dtabs (solo en modo crear normal, no en calculado) ── */}
      {!isEditing && !isCalculatedMode && (
        <MovementTypeTabs activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* ── Contenido — flex-1/min-h-0: el form activo (su propio <form> es
          flex-col) se lleva el alto restante y scrollea su cuerpo. El footer
          de acciones ya NO vive acá — es `ModalShellFooter` más abajo. ── */}
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
              onFooterStateChange={setFooterState}
            />
          ) : mode === "duplicate-single" ? (
            <TransactionForm
              transaction={null}
              prefill={props.transactionPrefill}
              onClose={onClose}
              onFooterStateChange={setFooterState}
            />
          ) : mode === "edit-fixed" ? (
            <RecurringForm
              recurring={props.recurring}
              onClose={onClose}
              viewMonth={props.viewMonth}
              editingSkipped={props.editingSkipped}
              onFooterStateChange={setFooterState}
            />
          ) : mode === "duplicate-fixed" ? (
            <RecurringForm
              recurring={null}
              prefill={props.recurringPrefill}
              onClose={onClose}
              viewMonth={props.viewMonth}
              onFooterStateChange={setFooterState}
            />
          ) : mode === "edit-installment" ? (
            <InstallmentForm
              installment={props.installment}
              onClose={onClose}
              editingSkipped={props.editingSkipped}
              onFooterStateChange={setFooterState}
            />
          ) : (
            <InstallmentForm
              installment={null}
              prefill={props.installmentPrefill}
              onClose={onClose}
              onFooterStateChange={setFooterState}
            />
          )}
        </div>
      ) : (
        <MovementCaptureForms
          activeTab={activeTab}
          onClose={onClose}
          onFooterStateChange={setFooterState}
          defaultMonth={defaultMonth}
        />
      )}

      {/* ── Footer — slot del envase, no del form (docs/design.md §Superficie
          de captura → "0. Encuadre"). Ausente en modo calculado:
          CalculatedForm todavía dibuja el suyo (fuera de este refactor). ── */}
      {!isCalculatedMode && (
        <ModalShellFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={footerState.isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={footerState.formId}
            size="sm"
            disabled={footerState.disabled}
            className="gap-1.5"
          >
            <Check size={14} aria-hidden="true" />
            {footerState.submitLabel}
          </Button>
        </ModalShellFooter>
      )}
    </ModalShell>
  );
}
