"use client";

/**
 * Prefill del método de pago por defecto al CREAR un movimiento — feature "Método de
 * pago por defecto por estructura" (RF-PM-007; ver también frontend.md §Métodos de pago).
 *
 * Reglas (decisiones cerradas del spec):
 *  - Solo aplica en CREACIÓN (isEditing = false); la edición carga el método del
 *    propio movimiento y el default nunca la pisa.
 *  - El default es por ESTRUCTURA (único/fijo/cuota), no por tipo — aplica tanto a
 *    egresos como a ingresos de esa estructura.
 *  - Es solo el VALOR INICIAL del selector — se aplica una única vez (ref one-shot)
 *    y solo si el campo sigue en "" (el usuario no lo tocó todavía), para no pisar
 *    una selección manual hecha mientras preferences/paymentMethods aún cargaban.
 *  - Fallback en lectura (decisión 6): el id guardado se valida contra los métodos
 *    de pago ACTIVOS; si no está entre ellos (fue eliminado), se trata como "ninguno"
 *    y el selector queda en "Sin método de pago". No hace falta limpiar el blob.
 *
 * Se dispara desde un `useEffect`, no puede aplicarse directo en `defaultValues` de
 * `useForm` porque `preferences` (usePreferences) y `paymentMethods` (usePaymentMethods)
 * pueden estar todavía cargando en el primer render del form.
 */

import { useEffect, useRef } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { usePaymentMethods } from "@/hooks/use-payment-methods";

export type DefaultPaymentMethodSlot = "unico" | "fijo" | "cuota";

export interface UseDefaultPaymentMethodPrefillOptions {
  /** Slot de la feature: "unico" (transaction-form) / "fijo" (recurring-form) / "cuota" (installment-form) */
  slot: DefaultPaymentMethodSlot;
  /** true en edición — el hook no hace nada (no-op) */
  isEditing: boolean;
  /** Valor actual del campo paymentMethodId del form ("" si no hay selección) */
  currentPaymentMethodId: string;
  /** Setter del campo (normalmente `(id) => setValue("paymentMethodId", id)`) */
  setPaymentMethodId: (id: string) => void;
}

export function useDefaultPaymentMethodPrefill({
  slot,
  isEditing,
  currentPaymentMethodId,
  setPaymentMethodId,
}: UseDefaultPaymentMethodPrefillOptions) {
  const { preferences, isLoading: isPreferencesLoading } = usePreferences();
  const { paymentMethods } = usePaymentMethods();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (isEditing) return;
    if (appliedRef.current) return;
    if (isPreferencesLoading) return;
    if (!paymentMethods) return;
    if (currentPaymentMethodId !== "") return;

    // One-shot: se marca aplicado ANTES de decidir si hay un id válido, para que
    // este efecto no vuelva a correr aunque no haya default configurado.
    appliedRef.current = true;

    const candidateId = preferences.defaultPaymentMethods?.[slot] ?? null;
    const isValid = candidateId !== null && paymentMethods.some((pm) => pm.id === candidateId);
    if (isValid) {
      setPaymentMethodId(candidateId as string);
    }
  }, [
    isEditing,
    isPreferencesLoading,
    paymentMethods,
    preferences,
    slot,
    currentPaymentMethodId,
    setPaymentMethodId,
  ]);
}
