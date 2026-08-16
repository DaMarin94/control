"use client";

/**
 * MovementCaptureForms — conmuta el form de ESCRITORIO activo (Único / Fijo /
 * Cuotas) en modo CREAR, dentro de `TransactionModal`. Desde el refactor de
 * capas (docs/design.md §Superficie de captura → "0. Encuadre — una lógica,
 * dos composiciones") es de uso EXCLUSIVO del modal de escritorio: la
 * superficie de captura tiene su propia composición hermana
 * (`CaptureMovementForms`, components/capture/), que consume los mismos hooks
 * de lógica pero arma su propia UI.
 */

import { type MovementTabId } from "@/components/movements/movement-type-tabs";
import { TransactionForm } from "@/components/movements/transaction-form";
import { RecurringForm } from "@/components/movements/recurring-form";
import { InstallmentForm } from "@/components/movements/installment-form";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";

export interface MovementCaptureFormsProps {
  activeTab: MovementTabId;
  onClose: () => void;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  defaultMonth?: string;
}

export function MovementCaptureForms({
  activeTab,
  onClose,
  onFooterStateChange,
  defaultMonth,
}: MovementCaptureFormsProps) {
  return (
    <>
      {activeTab === "single" && (
        <div
          id="tab-panel-single"
          role="tabpanel"
          aria-labelledby="tab-single"
          className="flex-1 min-h-0 flex flex-col"
        >
          <TransactionForm
            transaction={null}
            onClose={onClose}
            onFooterStateChange={onFooterStateChange}
          />
        </div>
      )}
      {activeTab === "fixed" && (
        <div
          id="tab-panel-fixed"
          role="tabpanel"
          aria-labelledby="tab-fixed"
          className="flex-1 min-h-0 flex flex-col"
        >
          <RecurringForm
            recurring={null}
            onClose={onClose}
            defaultMonth={defaultMonth}
            onFooterStateChange={onFooterStateChange}
          />
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
            onFooterStateChange={onFooterStateChange}
          />
        </div>
      )}
    </>
  );
}
