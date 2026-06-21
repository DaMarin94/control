"use client";

/**
 * CurrencyExchangeBlock — Bloque "Moneda y cotización" para formularios (Fase 1.2.4).
 *
 * Aparece DEBAJO del campo Monto, ANTES de Categoría.
 * Aplica a: TransactionForm, RecurringForm, InstallmentForm.
 * NO aplica a: CalculatedForm (hereda del origen, no muestra el bloque).
 *
 * Spec visual (docs/design.md §4 — Bloque moneda+cotización colapsable + caso moneda=default):
 *
 * (A) DISCLOSURE COLAPSABLE — El bloque entero vive dentro de un disclosure.
 *   - Trigger: <button> al aire, chevron ChevronRight 16px que rota ▶→▼.
 *   - Label exacto: "Moneda y cotización" (13px/600, --ink-2).
 *   - Resumen a la derecha cuando colapsado: moneda==default → solo código "ARS"; moneda≠default → "USD · 1.480,00".
 *   - Arranca SIEMPRE colapsado (también en edición con moneda extranjera).
 *   - Animación: grid-rows 0fr↔1fr + fade + rotación chevron, 0.22s ease-out.
 *   - prefers-reduced-motion: instantáneo.
 *
 * (B) CONTENIDO SEGÚN MONEDA SELECCIONADA:
 *   - moneda==default: solo selector de moneda a ancho completo (una columna, sin compact).
 *     No hay label "Cotización", no hay input, no hay prefijo, no hay field-note.
 *   - moneda≠default: grid grid-cols-2 gap-[14px] → col izq selector (compact=true) + col der cotización completa.
 *
 * LÓGICA: cuando currency === defaultCurrency, el onSubmit de los forms envía exchangeRate = 1.
 * El campo cotización no se renderiza en ese caso — el form no lee el campo oculto.
 *
 * DEROGA: la regla previa de 1.2.3 "campo cotización SIEMPRE visible".
 * DEROGA: buildPairLabel (caso inventado moneda===default).
 */

import { useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CurrencySegmented } from "@/components/ui/currency-segmented";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

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
  // Arranca SIEMPRE colapsado — sin excepciones, también en edición con moneda extranjera.
  const [isOpen, setIsOpen] = useState(false);

  const isDefault = currency === defaultCurrency;

  // Prefijo del par de cotización (solo cuando moneda ≠ default).
  const pairLabel = isDefault ? "" : `${currency}→${defaultCurrency}`;

  // ─── Resumen para el trigger colapsado ────────────────────────────────────
  // moneda==default: solo el código (sin cotización que mostrar).
  // moneda≠default: "USD · 1.480,00" (código + "·" + cotización).
  const summaryCode = currency; // ej. "ARS" o "USD"
  const summaryRate = isDefault ? null : exchangeRateInput || null;

  const bodyId = "currency-exchange-body";

  return (
    <div className="flex flex-col">
      {/* ── Trigger del disclosure ─────────────────────────────────────────── */}
      <button
        type="button"
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

        {/* Label "Moneda y cotización" */}
        <span
          className={cn(
            "text-[13px] font-semibold tracking-[0.01em] transition-colors duration-[140ms]",
            "text-ink-2 group-hover:text-ink",
          )}
        >
          Moneda y cotización
        </span>

        {/* Resumen a la derecha — solo visible cuando colapsado */}
        {!isOpen && (
          <span className="ml-auto flex items-center gap-[5px] min-w-0">
            {/* Código de moneda — mono 12px --muted */}
            <span className="mono text-[12px] text-muted">{summaryCode}</span>

            {/* Cotización — solo si moneda ≠ default */}
            {summaryRate !== null && (
              <>
                {/* Separador · en --faint */}
                <span className="text-[12px] text-faint" aria-hidden="true">
                  ·
                </span>
                {/* Cotización en mono --ink-2 */}
                <span className="mono text-[12px] text-ink-2">{summaryRate}</span>
              </>
            )}
          </span>
        )}
      </button>

      {/* ── Cuerpo del disclosure (animación grid-rows 0fr↔1fr + fade) ──────── */}
      {/*
       * Mismo patrón que AccordionSection: grid exterior controla la altura con
       * grid-rows-[0fr]↔[1fr]. El div interior (min-h-0) necesario para la compresión.
       * La transición tiene 0.22s ease-out para coincidir exactamente con el Acordeón.
       * prefers-reduced-motion: motion-reduce:transition-none (clase Tailwind).
       */}
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
            {isDefault ? (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
