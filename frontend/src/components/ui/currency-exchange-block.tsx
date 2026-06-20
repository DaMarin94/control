"use client";

/**
 * CurrencyExchangeBlock — Bloque "Moneda y cotización" para formularios (Fase 1.2.3).
 *
 * Aparece DEBAJO del campo Monto, ANTES de Categoría.
 * Aplica a: TransactionForm, RecurringForm, InstallmentForm.
 * NO aplica a: CalculatedForm (hereda del origen, no muestra el bloque).
 *
 * Spec visual (docs/design.md §"B. Moneda + cotización en el formulario de movimiento"):
 * - Grid 2-col gap-[14px] SIEMPRE: col izq = selector moneda, col der = input cotización.
 * - El campo cotización va SIEMPRE visible y editable, también cuando moneda === defaultCurrency.
 *   El spec prohibe ocultarlo: el roadmap exige capturar y persistir la cotización real siempre.
 * - Prefijo de par dinámico: cuando moneda ≠ default → "USD→ARS" / "ARS→USD"; cuando
 *   moneda === default → dirección de la OTRA moneda contra la default (ej. "USD→ARS" si default=ARS).
 * - Campo cotización: caja igual al Monto (flex items-center gap-2 rounded-ctl
 *   border-[1.5px] px-[13px] py-[11px]) con prefijo de par en mono 12px --muted
 *   + input mono 15px font-semibold text-ink.
 * - Nota debajo del campo cotización:
 *   - Sin tocar: "Último cambio usado" + ícono History 12px --muted.
 *   - Editado: "Cotización modificada" en --ink-2.
 * - Para fijos: nota "Cotización para {Mes Año}" (misma nota field-note).
 * - Validación cotización > 0: borde --expense + ring --expense-soft + msg --expense-ink.
 */

import { History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_CURRENCIES: CurrencyCode[] = ["ARS", "USD"];

/**
 * Construye el rótulo del par de cotización.
 *
 * - Cuando moneda ≠ default: "USD→ARS" (precio de 1 unidad de la no-default en la default).
 * - Cuando moneda === default: se muestra la dirección de la OTRA moneda contra la default,
 *   para registrar el tipo de cambio vigente incluso en el caso mono-moneda.
 *   Ej. default=ARS, moneda=ARS → la "otra" es USD → "USD→ARS".
 *       default=USD, moneda=USD → la "otra" es ARS → "ARS→USD".
 */
function buildPairLabel(selectedCurrency: CurrencyCode, defaultCurrency: CurrencyCode): string {
  if (selectedCurrency !== defaultCurrency) {
    return `${selectedCurrency}→${defaultCurrency}`;
  }
  // moneda === default: usar la otra moneda como origen
  const other = ALL_CURRENCIES.find((c) => c !== defaultCurrency) ?? selectedCurrency;
  return `${other}→${defaultCurrency}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CurrencyExchangeBlockProps {
  /** Moneda actualmente seleccionada en el form */
  currency: CurrencyCode;
  /** Cotización como string (para el input controlado, puede tener decimales) */
  exchangeRateInput: string;
  /** Moneda default del usuario (determina cuándo mostrar cotización) */
  defaultCurrency: CurrencyCode;
  /** Si el valor de cotización fue modificado por el usuario (cambia la nota) */
  isExchangeRateModified: boolean;
  /** Error de validación de cotización (cuando aplica) */
  exchangeRateError?: string;
  /** Para fijos: texto de nota extra (ej. "Cotización para Junio 2026") */
  recurringMonthNote?: string;
  /** Callbacks */
  onCurrencyChange: (value: CurrencyCode) => void;
  onExchangeRateChange: (value: string) => void;
  /** ID para la fila del input de cotización (a11y) */
  exchangeRateInputId?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CurrencyExchangeBlock({
  currency,
  exchangeRateInput,
  defaultCurrency,
  isExchangeRateModified,
  exchangeRateError,
  recurringMonthNote,
  onCurrencyChange,
  onExchangeRateChange,
  exchangeRateInputId = "exchange-rate",
}: CurrencyExchangeBlockProps) {
  // El campo cotización va SIEMPRE visible (el spec prohíbe ocultarlo por moneda==default).
  const pairLabel = buildPairLabel(currency, defaultCurrency);

  return (
    <div className="flex flex-col gap-[7px]">
      {/* Grid 2-col SIEMPRE: moneda (izq) + cotización (der) */}
      <div className="grid grid-cols-2 gap-[14px]">
        {/* Col izq: Selector de moneda */}
        <div className="flex flex-col gap-[7px]">
          <Label
            htmlFor="currency-selector"
            className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]"
          >
            Moneda
          </Label>
          <CurrencySegmented
            value={currency}
            onChange={onCurrencyChange}
            ariaLabel="Moneda"
          />
        </div>

        {/* Col der: Cotización — siempre presente, también cuando moneda === default */}
        <div className="flex flex-col gap-[7px]">
          <Label
            htmlFor={exchangeRateInputId}
            className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]"
          >
            Cotización
          </Label>
          <div
            className={cn(
              "flex items-center gap-2 rounded-ctl border-[1.5px] px-[13px] py-[11px] transition-colors duration-[140ms]",
              "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
              exchangeRateError
                ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                : "border-line-strong bg-panel",
            )}
          >
            {/* Prefijo de par: ej. "USD→ARS" */}
            <span className="text-[12px] text-muted mono shrink-0 select-none">
              {pairLabel}
            </span>
            <input
              id={exchangeRateInputId}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={exchangeRateInput}
              onChange={(e) => onExchangeRateChange(e.target.value)}
              className="flex-1 border-none outline-none bg-transparent mono text-[15px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
            />
          </div>

          {/* Error de validación */}
          {exchangeRateError && (
            <p className="text-[12px] text-expense-ink">{exchangeRateError}</p>
          )}

          {/* Nota de estado (solo si no hay error) */}
          {!exchangeRateError && (
            <p className="flex items-center gap-[5px] text-[12px] mt-[2px]">
              {isExchangeRateModified ? (
                <span className="text-ink-2">Cotización modificada</span>
              ) : (
                <>
                  <History size={12} className="text-muted shrink-0" aria-hidden="true" />
                  <span className="text-muted">Último cambio usado</span>
                </>
              )}
            </p>
          )}

          {/* Nota extra para fijos (ej. "Cotización para Junio 2026") */}
          {recurringMonthNote && !exchangeRateError && (
            <p className="text-[12px] text-muted mt-[2px]">{recurringMonthNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}
