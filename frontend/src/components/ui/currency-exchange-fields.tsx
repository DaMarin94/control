"use client";

/**
 * CurrencyExchangeFields — Sub-bloque "Moneda y cotización" (contenido plano, SIN
 * disclosure propio). Extraído de CurrencyExchangeBlock (Fase 1.2.4) al agrupar
 * moneda+cotización y método de pago dentro de un único disclosure "Más opciones"
 * (docs/design.md §4 "Disclosure 'Más opciones' del form").
 *
 * Vive como PRIMER sub-bloque del cuerpo de <MoreOptionsSection> (movements/more-options-section.tsx).
 * Aplica a: TransactionForm, RecurringForm, InstallmentForm (vía MoreOptionsSection).
 * NO aplica a: CalculatedForm (hereda del origen, no muestra la sección).
 *
 * Spec visual (docs/design.md §4E — Sub-bloque Moneda+cotización):
 *
 * - moneda==default: solo selector de moneda a ancho completo (una columna, sin compact).
 *   No hay label "Cotización", no hay input, no hay prefijo, no hay field-note.
 * - moneda≠default: grid grid-cols-2 gap-[14px] → col izq selector (compact=true) + col der cotización completa.
 *
 * LÓGICA: cuando currency === defaultCurrency, el onSubmit de los forms envía exchangeRate = 1.
 * El campo cotización no se renderiza en ese caso — el form no lee el campo oculto.
 * (Sin cambios respecto de CurrencyExchangeBlock — solo se retiró el chevron/trigger propio.)
 */

import { History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CurrencyExchangeFieldsProps {
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

export function CurrencyExchangeFields({
  currency,
  exchangeRateInput,
  defaultCurrency,
  isExchangeRateModified,
  exchangeRateError,
  recurringMonthNote,
  onCurrencyChange,
  onExchangeRateChange,
  exchangeRateInputId = "exchange-rate",
}: CurrencyExchangeFieldsProps) {
  const isDefault = currency === defaultCurrency;

  // Prefijo del par de cotización (solo cuando moneda ≠ default).
  const pairLabel = isDefault ? "" : `${currency}→${defaultCurrency}`;

  return isDefault ? (
    /* ── moneda==default: selector a ancho completo, sin cotización ── */
    <div className="flex flex-col gap-[7px]">
      <Label
        htmlFor="currency-selector"
        className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]"
      >
        Moneda
      </Label>
      {/*
       * Sin compact: el segmented ocupa todo el ancho del form.
       * px-[14px] normal para los 4 segmentos.
       */}
      <CurrencySegmented
        value={currency}
        onChange={onCurrencyChange}
        ariaLabel="Moneda"
        compact={false}
      />
    </div>
  ) : (
    /* ── moneda≠default: grid 2-col selector + cotización ── */
    <div className="grid grid-cols-2 gap-[14px]">
      {/* Col izq: Selector de moneda (compact=true — mitad del ancho) */}
      <div className="flex flex-col gap-[7px]">
        <Label
          htmlFor="currency-selector"
          className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]"
        >
          Moneda
        </Label>
        {/*
         * compact=true: el segmented ocupa la mitad del grid de 2 col.
         * Padding reducido a px-[8px] para que las 4 etiquetas entren sin recorte.
         */}
        <CurrencySegmented
          value={currency}
          onChange={onCurrencyChange}
          ariaLabel="Moneda"
          compact={true}
        />
      </div>

      {/* Col der: Cotización — solo cuando moneda ≠ default */}
      {/*
       * Transición al cambiar moneda con disclosure abierto:
       * la columna de cotización hace fade + leve expansión de ancho (~0.14-0.18s).
       * Se logra con transition-[opacity] en el wrapper de la columna.
       * Con prefers-reduced-motion: instantáneo (motion-reduce:transition-none).
       */}
      <div
        className={cn(
          "flex flex-col gap-[7px]",
          "transition-[opacity] duration-[160ms] ease-out motion-reduce:transition-none",
        )}
      >
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
          {/* Prefijo de par: ej. "USD→ARS", "EUR→ARS", "BRL→USD" */}
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
                <span className="text-muted">Cotización de referencia del mes</span>
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
  );
}
