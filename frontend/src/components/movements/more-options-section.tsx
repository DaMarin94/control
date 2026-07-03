"use client";

/**
 * MoreOptionsSection — Disclosure "Más opciones" del form de movimiento (tabs
 * Único / Fijo / Cuota), P4. Agrupa dos campos secundarios dentro de un único
 * disclosure colapsable: (a) moneda+cotización y (b) método de pago + su checkbox
 * condicional "Débito automático" (docs/design.md §4 "Disclosure 'Más opciones'
 * del form — moneda+cotización + método de pago").
 *
 * Reemplaza: el disclosure propio que tenía CurrencyExchangeBlock ("Moneda y
 * cotización") + el bloque de método de pago que vivía siempre visible después
 * de Categoría. Ambos ahora son sub-bloques de ESTE único disclosure.
 *
 * Ubicación: el mismo slot que ocupaba el disclosure de moneda — debajo de Monto,
 * antes de Categoría. Arranca SIEMPRE colapsado (también en edición).
 *
 * NO se usa en CalculatedForm (hereda moneda/cotización del origen, sin método).
 *
 * Compartido por TransactionForm / RecurringForm / InstallmentForm — evita
 * triplicar el markup del disclosure + resumen combinado.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CurrencyExchangeFields } from "@/components/ui/currency-exchange-fields";
import { PaymentMethodSelect } from "@/components/movements/payment-method-select";
import { AutoDebitCheckbox } from "@/components/movements/auto-debit-checkbox";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MoreOptionsSectionProps {
  /** Prefijo para ids únicos de los controles internos (ej. "tx", "rec", "inst") */
  idPrefix: string;

  // ── Moneda + cotización (pass-through a CurrencyExchangeFields) ──
  currency: CurrencyCode;
  exchangeRateInput: string;
  defaultCurrency: CurrencyCode;
  isExchangeRateModified: boolean;
  exchangeRateError?: string;
  recurringMonthNote?: string;
  onCurrencyChange: (value: CurrencyCode) => void;
  onExchangeRateChange: (value: string) => void;

  // ── Método de pago ──
  paymentMethodId: string;
  onPaymentMethodChange: (value: string) => void;

  // ── Débito automático ──
  autoDebit: boolean;
  onAutoDebitChange: (checked: boolean) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MoreOptionsSection({
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
}: MoreOptionsSectionProps) {
  // Arranca SIEMPRE colapsado — sin excepciones, también en edición.
  const [isOpen, setIsOpen] = useState(false);

  const { paymentMethods } = usePaymentMethods();
  const selectedMethod = (paymentMethods ?? []).find((pm) => pm.id === paymentMethodId) ?? null;
  const isDebitMethodSelected = selectedMethod?.type === "DEBIT";

  const isDefault = currency === defaultCurrency;

  // ─── Resumen para el trigger colapsado ────────────────────────────────────
  // Segmento moneda (siempre presente): código; si ≠ default suma "· {cotización}".
  const summaryCode = currency;
  const summaryRate = isDefault ? null : exchangeRateInput || null;

  const bodyId = `${idPrefix}-more-options-body`;

  return (
    <div className="flex flex-col">
      {/* ── Trigger del disclosure ─────────────────────────────────────────── */}
      <button
        type="button"
        id={`${idPrefix}-more-options-trigger`}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center gap-[7px] py-[7px] cursor-pointer",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-[var(--r-chip)]",
          "transition-colors duration-[140ms]",
          "group",
        )}
      >
        {/* Chevron que rota: colapsado → ▶ (0°), expandido → ▼ (90°) */}
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

        {/* Label "Más opciones" */}
        <span
          className={cn(
            "text-[13px] font-semibold tracking-[0.01em] transition-colors duration-[140ms]",
            "text-ink-2 group-hover:text-ink",
          )}
        >
          Más opciones
        </span>

        {/* Resumen combinado a la derecha — solo visible cuando colapsado */}
        {!isOpen && (
          <span className="ml-auto flex items-center min-w-0">
            {/* Segmento moneda — siempre presente, nunca se trunca */}
            <span className="flex items-center gap-[5px] shrink-0">
              <span className="mono text-[12px] text-muted">{summaryCode}</span>
              {summaryRate !== null && (
                <>
                  <span className="text-[12px] text-faint" aria-hidden="true">
                    ·
                  </span>
                  <span className="mono text-[12px] text-ink-2">{summaryRate}</span>
                </>
              )}
            </span>

            {/* Divisor de grupo + segmento método — solo si hay método elegido */}
            {selectedMethod && (
              <>
                <span
                  className="w-px h-[12px] bg-line mx-[8px] shrink-0 self-center"
                  aria-hidden="true"
                />
                <span className="flex items-center gap-[5px] min-w-0">
                  <PaymentMethodIcon
                    icon={selectedMethod.icon}
                    size={16}
                    className="shrink-0 text-ink-2"
                  />
                  <span className="text-[12px] text-ink-2 truncate">{selectedMethod.name}</span>
                </span>
              </>
            )}
          </span>
        )}
      </button>

      {/* ── Cuerpo del disclosure (animación grid-rows 0fr↔1fr + fade) ──────── */}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* mt-[7px] separa el trigger del contenido expandido */}
          <div className="mt-[7px]">
            {/* ── Sub-bloque 1: Moneda+cotización ── */}
            <CurrencyExchangeFields
              currency={currency}
              exchangeRateInput={exchangeRateInput}
              defaultCurrency={defaultCurrency}
              isExchangeRateModified={isExchangeRateModified}
              exchangeRateError={exchangeRateError}
              recurringMonthNote={recurringMonthNote}
              onCurrencyChange={onCurrencyChange}
              onExchangeRateChange={onExchangeRateChange}
              exchangeRateInputId={`${idPrefix}-exchange-rate`}
            />

            {/* — divisor hairline — */}
            <div className="h-px bg-hair my-[14px]" aria-hidden="true" />

            {/* ── Sub-bloque 2: Método de pago (+ Débito automático condicional) ── */}
            <div className="flex flex-col gap-[14px]">
              <div className="flex flex-col gap-[7px]">
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
                <AutoDebitCheckbox
                  id={`${idPrefix}-auto-debit`}
                  checked={autoDebit}
                  onChange={onAutoDebitChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
