"use client";

/**
 * CaptureMoreOptions — disclosure "Más opciones" propio de la superficie de
 * captura (docs/design.md §Superficie de captura → §4 "Densidad táctil y
 * ritmo" + §7 "Cuerpo"). Composición hermana de `MoreOptionsSection`
 * (movements/more-options-section.tsx, usada por el modal de escritorio):
 * mismo conjunto de campos y mismos defaults (capa 1, compartida vía los
 * hooks `use*FormLogic`), estructura de DOM y densidad propias — nunca
 * deriva de la versión de escritorio ni la reusa con overrides de cascada.
 *
 * Reusa `PaymentMethodSelect` / `AutoDebitCheckbox` TAL CUAL (son controles
 * interactivos con lógica de posicionamiento propia — portal + listbox — no
 * puramente visual): ninguno es un input de texto nativo, así que no están
 * sujetos al piso de 16px anti-zoom (§4). El campo de cotización SÍ es un
 * input de texto tipeable → se reconstruye acá con la caja/tipografía propia
 * de esta superficie (16px, 14/13px de padding).
 *
 * `CurrencySegmented` se reusa con `touchTarget="roomy"` (opt-in del propio
 * componente, ver su comentario): el resto de su geometría/color es idéntico
 * a la versión de escritorio, solo cambia el padding vertical del segmento
 * para cumplir el piso de 44px de esta superficie (§4) — la versión de
 * escritorio no pasa esta prop y queda sin cambios.
 */

import { History } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { PaymentMethodSelect } from "@/components/movements/payment-method-select";
import { AutoDebitCheckbox } from "@/components/movements/auto-debit-checkbox";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

export interface CaptureMoreOptionsProps {
  idPrefix: string;
  currency: CurrencyCode;
  exchangeRateInput: string;
  defaultCurrency: CurrencyCode;
  isExchangeRateModified: boolean;
  exchangeRateError?: string;
  recurringMonthNote?: string;
  onCurrencyChange: (value: CurrencyCode) => void;
  onExchangeRateChange: (value: string) => void;
  paymentMethodId: string;
  onPaymentMethodChange: (value: string) => void;
  autoDebit: boolean;
  onAutoDebitChange: (checked: boolean) => void;
}

export function CaptureMoreOptions({
  idPrefix,
  currency,
  exchangeRateInput,
  defaultCurrency,
  isExchangeRateModified,
  exchangeRateError,
  recurringMonthNote,
  onCurrencyChange,
  onExchangeRateChange,
  paymentMethodId,
  onPaymentMethodChange,
  autoDebit,
  onAutoDebitChange,
}: CaptureMoreOptionsProps) {
  // Arranca SIEMPRE colapsado — sin excepciones, también en edición.
  const [isOpen, setIsOpen] = useState(false);

  const { paymentMethods } = usePaymentMethods();
  const selectedMethod = (paymentMethods ?? []).find((pm) => pm.id === paymentMethodId) ?? null;
  const isDebitMethodSelected = selectedMethod?.type === "DEBIT";

  const isDefault = currency === defaultCurrency;
  const summaryRate = isDefault ? null : exchangeRateInput || null;
  const bodyId = `${idPrefix}-more-options-body`;
  const exchangeRateInputId = `${idPrefix}-exchange-rate`;
  const pairLabel = isDefault ? "" : `${currency}→${defaultCurrency}`;

  return (
    <div className="flex flex-col">
      {/* ── Trigger — fila entera tocable, 44px (§4) ── */}
      <button
        type="button"
        id={`${idPrefix}-more-options-trigger`}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center gap-[8px] py-[12px] min-h-[44px] cursor-pointer",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-[var(--r-chip)]",
          "transition-colors duration-[140ms]",
          "group",
        )}
      >
        <ChevronRight
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-[transform,color] duration-[220ms] ease-out motion-reduce:transition-none",
            "text-muted group-hover:text-ink-2",
            isOpen && "rotate-90",
          )}
        />
        <span className="text-[13px] font-semibold tracking-[0.01em] text-ink-2">
          Más opciones
        </span>

        {!isOpen && (
          <span className="ml-auto flex items-center min-w-0">
            <span className="flex items-center gap-[5px] shrink-0">
              <span className="mono text-[12px] text-muted">{currency}</span>
              {summaryRate !== null && (
                <>
                  <span className="text-[12px] text-faint" aria-hidden="true">·</span>
                  <span className="mono text-[12px] text-ink-2">{summaryRate}</span>
                </>
              )}
            </span>
            {selectedMethod && (
              <>
                <span className="w-px h-[12px] bg-line mx-[8px] shrink-0 self-center" aria-hidden="true" />
                <span className="flex items-center gap-[5px] min-w-0">
                  <PaymentMethodIcon icon={selectedMethod.icon} size={16} className="shrink-0 text-ink-2" />
                  <span className="text-[12px] text-ink-2 truncate">{selectedMethod.name}</span>
                </span>
              </>
            )}
          </span>
        )}
      </button>

      {/* ── Cuerpo del disclosure ── */}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-[10px] flex flex-col gap-[16px]">
            {/* ── Moneda + cotización ── */}
            {isDefault ? (
              <div className="flex flex-col gap-[6px]">
                <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                  Moneda
                </Label>
                <CurrencySegmented value={currency} onChange={onCurrencyChange} ariaLabel="Moneda" compact={false} touchTarget="roomy" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-[14px]">
                <div className="flex flex-col gap-[6px]">
                  <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                    Moneda
                  </Label>
                  <CurrencySegmented value={currency} onChange={onCurrencyChange} ariaLabel="Moneda" compact={true} touchTarget="roomy" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <Label htmlFor={exchangeRateInputId} className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                    Cotización
                  </Label>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-ctl border-[1.5px] px-[14px] py-[13px] transition-colors duration-[140ms]",
                      "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
                      exchangeRateError
                        ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                        : "border-line-strong bg-panel",
                    )}
                  >
                    <span className="text-[12px] text-muted mono shrink-0 select-none">{pairLabel}</span>
                    <input
                      id={exchangeRateInputId}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={exchangeRateInput}
                      onChange={(e) => onExchangeRateChange(e.target.value)}
                      className="flex-1 min-w-0 border-none outline-none bg-transparent mono text-[16px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
                    />
                  </div>
                  {exchangeRateError ? (
                    <p className="text-[12px] text-expense-ink">{exchangeRateError}</p>
                  ) : (
                    <p className="flex items-center gap-[5px] text-[12px]">
                      {isExchangeRateModified ? (
                        <span className="text-ink-2">Cotización modificada</span>
                      ) : (
                        <>
                          <History size={12} className="text-muted shrink-0" aria-hidden="true" />
                          <span className="text-muted">Cotización de referencia del mes</span>
                        </>
                      )}
                    </p>
                  )}
                  {recurringMonthNote && !exchangeRateError && (
                    <p className="text-[12px] text-muted">{recurringMonthNote}</p>
                  )}
                </div>
              </div>
            )}

            {/* — divisor hairline — */}
            <div className="h-px bg-hair" aria-hidden="true" />

            {/* ── Método de pago (+ Débito automático condicional) ── */}
            <div className="flex flex-col gap-[16px]">
              <div className="flex flex-col gap-[6px]">
                <Label
                  htmlFor={`${idPrefix}-payment-method`}
                  className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]"
                >
                  Método de pago <span className="text-faint font-normal">(opcional)</span>
                </Label>
                <PaymentMethodSelect
                  id={`${idPrefix}-payment-method`}
                  value={paymentMethodId}
                  onChange={onPaymentMethodChange}
                />
              </div>

              {isDebitMethodSelected && (
                <div className="flex min-h-[44px] items-center">
                  <AutoDebitCheckbox
                    id={`${idPrefix}-auto-debit`}
                    checked={autoDebit}
                    onChange={onAutoDebitChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
