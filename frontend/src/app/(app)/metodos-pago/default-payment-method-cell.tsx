"use client";

/**
 * Indicador de solo-lectura "Predeterminado" en la fila de /metodos-pago —
 * feature "Método de pago predeterminado por estructura" (RF-PM-007).
 * Spec visual: docs/design.md, §"Predeterminado por estructura — configuración
 * en el modal + indicador de solo-lectura en la fila de /metodos-pago" →
 * "Indicador de solo-lectura en la fila".
 *
 * Reemplaza a la celda-botón + popover (que se eliminaron): la edición del
 * default vive ahora exclusivamente en PaymentMethodFormModal (kebab → Editar).
 * Este componente es puramente informativo:
 * - NO es `<button>`, NO tiene `aria-haspopup`, NO tiene hover-reveal de
 *   afordancia, NO es foco de tab, NO abre nada.
 * - Método SIN defaults: no renderiza contenido (cero impacto).
 * - Método CON ≥1 default: Star relleno 11px + una pill por estructura, orden
 *   fijo Únicos → Fijos → Cuotas. En touch/≤940px con >1 pill, colapsa a
 *   "Predet. ×N".
 */

import { Star } from "lucide-react";
import type { PaymentMethod } from "@/types/payment-method";
import {
  DEFAULT_PAYMENT_METHOD_SLOT_ORDER,
  DEFAULT_PAYMENT_METHOD_SLOT_LABELS,
  type DefaultPaymentMethodSlots,
} from "./default-payment-method-slots";

export {
  DEFAULT_PAYMENT_METHOD_SLOT_ORDER,
  DEFAULT_PAYMENT_METHOD_SLOT_LABELS,
  EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS,
  type DefaultPaymentMethodSlot,
  type DefaultPaymentMethodSlots,
} from "./default-payment-method-slots";

export interface DefaultPaymentMethodCellProps {
  method: PaymentMethod;
  defaultPaymentMethods: DefaultPaymentMethodSlots;
}

export function DefaultPaymentMethodCell({
  method,
  defaultPaymentMethods,
}: DefaultPaymentMethodCellProps) {
  const activeSlots = DEFAULT_PAYMENT_METHOD_SLOT_ORDER.filter(
    (slot) => defaultPaymentMethods[slot] === method.id,
  );

  // Cero impacto sin config: no renderiza nada.
  if (activeSlots.length === 0) return null;

  const ariaLabel = `Predeterminado de: ${activeSlots
    .map((slot) => DEFAULT_PAYMENT_METHOD_SLOT_LABELS[slot])
    .join(", ")}`;

  return (
    <span
      className="flex flex-shrink-0 items-center gap-1"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Star size={11} className="shrink-0 text-accent" fill="currentColor" aria-hidden="true" />

      {/* Desktop (≥941px): una pill por estructura, orden fijo Únicos → Fijos → Cuotas */}
      <span className="hidden [@media(min-width:941px)]:flex items-center gap-1">
        {activeSlots.map((slot) => (
          <span
            key={slot}
            className="inline-flex items-center rounded-chip bg-accent-soft px-[7px] py-[2px] text-[11px] font-semibold text-accent-ink"
          >
            {DEFAULT_PAYMENT_METHOD_SLOT_LABELS[slot]}
          </span>
        ))}
      </span>

      {/* Touch/≤940px: colapsa a "Predet. ×N" cuando hay más de una */}
      <span className="[@media(min-width:941px)]:hidden flex items-center">
        <span className="inline-flex items-center rounded-chip bg-accent-soft px-[7px] py-[2px] text-[11px] font-semibold text-accent-ink">
          {activeSlots.length > 1 ? (
            <>
              Predet. ×<span className="mono">{activeSlots.length}</span>
            </>
          ) : (
            DEFAULT_PAYMENT_METHOD_SLOT_LABELS[activeSlots[0]!]
          )}
        </span>
      </span>
    </span>
  );
}
