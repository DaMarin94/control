"use client";

/**
 * CaptureMovementForms — conmuta el form de la SUPERFICIE DE CAPTURA activo
 * (Único / Fijo / Cuotas), siempre en modo crear (RF-APP-003). Composición
 * hermana de `MovementCaptureForms` (movements/movement-capture-forms.tsx,
 * usada por el modal de escritorio): monta la composición de captura de
 * cada tipo (`CaptureTransactionForm` / `CaptureRecurringForm` /
 * `CaptureInstallmentForm`), todas consumiendo los mismos hooks de lógica
 * que sus hermanas de escritorio.
 */

import { type RefObject } from "react";
import { type MovementTabId } from "@/components/capture/capture-movement-type-tabs";
import { CaptureTransactionForm } from "@/components/capture/capture-transaction-form";
import { CaptureRecurringForm } from "@/components/capture/capture-recurring-form";
import { CaptureInstallmentForm } from "@/components/capture/capture-installment-form";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";

export interface CaptureMovementFormsProps {
  activeTab: MovementTabId;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  onCreateSuccess: () => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

export function CaptureMovementForms({
  activeTab,
  onFooterStateChange,
  onCreateSuccess,
  scrollContainerRef,
}: CaptureMovementFormsProps) {
  return (
    <>
      {activeTab === "single" && (
        <div id="tab-panel-single" role="tabpanel" aria-labelledby="tab-single" className="flex-1 min-h-0 flex flex-col">
          <CaptureTransactionForm
            onFooterStateChange={onFooterStateChange}
            onCreateSuccess={onCreateSuccess}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      )}
      {activeTab === "fixed" && (
        <div id="tab-panel-fixed" role="tabpanel" aria-labelledby="tab-fixed" className="flex-1 min-h-0 flex flex-col">
          <CaptureRecurringForm
            onFooterStateChange={onFooterStateChange}
            onCreateSuccess={onCreateSuccess}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      )}
      {activeTab === "installments" && (
        <div id="tab-panel-installments" role="tabpanel" aria-labelledby="tab-installments" className="flex-1 min-h-0 flex flex-col">
          <CaptureInstallmentForm
            onFooterStateChange={onFooterStateChange}
            onCreateSuccess={onCreateSuccess}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      )}
    </>
  );
}
