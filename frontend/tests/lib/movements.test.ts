/**
 * Tests unitarios de lib/movements.ts (RN-019).
 *
 * Verifica que sumMovementTotals y groupSubtotalCents usen
 * Math.abs(convertedAmountCents) — NO amountCents — para los totales.
 *
 * Motivación del cambio (Fase 1.2.3 multi-moneda):
 * - `convertedAmountCents` es el monto en la moneda default del usuario (backend).
 * - `amountCents` conserva la moneda original; usarlo para sumar totales mezclaría
 *   monedas cuando el usuario registra ítems en distintas divisas.
 * - Los calculados EXPENSE tienen convertedAmountCents negativo; Math.abs() normaliza.
 *
 * Los fixtures con `amountCents !== convertedAmountCents` demuestran que la
 * implementación consume el campo correcto.
 */

import { describe, it, expect } from "vitest";
import { sumMovementTotals, groupSubtotalCents } from "@/lib/movements";
import type { MovementItem } from "@/types/movement";

// ─── Fixtures mínimos ──────────────────────────────────────────────────────────

/**
 * Crea un MovementItem mínimo con amountCents y convertedAmountCents
 * independientes para verificar que la implementación usa el campo correcto.
 *
 * Por defecto convertedAmountCents === amountCents (back-compat ARS).
 * Pasar convertedAmountCents explícito para tests multi-moneda.
 */
function makeItem(
  type: "EXPENSE" | "INCOME",
  amountCents: number,
  id = "m1",
  convertedAmountCents?: number,
): MovementItem {
  return {
    id,
    origin: "unico",
    type,
    amountCents,
    description: null,
    occurredAt: null,
    timezone: null,
    installment: null,
    frequency: null,
    skipped: false,
    category: { id: "cat-1", name: "Test", color: "#000", scope: "BOTH" },
    calculated: null,
    hasCalculated: false,
    currency: convertedAmountCents !== undefined ? "USD" : "ARS",
    exchangeRate: convertedAmountCents !== undefined ? 1200 : 1,
    convertedAmountCents: convertedAmountCents ?? amountCents,
  };
}

// ─── sumMovementTotals ─────────────────────────────────────────────────────────

describe("sumMovementTotals", () => {
  it("lista vacía → { expense: 0, income: 0 }", () => {
    expect(sumMovementTotals([])).toEqual({ expense: 0, income: 0 });
  });

  it("EXPENSE normal (convertedAmountCents positivo) suma su magnitud en expense", () => {
    const result = sumMovementTotals([makeItem("EXPENSE", 15000)]);
    expect(result).toEqual({ expense: 15000, income: 0 });
  });

  it("INCOME normal (convertedAmountCents positivo) suma su magnitud en income", () => {
    const result = sumMovementTotals([makeItem("INCOME", 500000)]);
    expect(result).toEqual({ expense: 0, income: 500000 });
  });

  it("EXPENSE calculado con convertedAmountCents NEGATIVO suma la magnitud (no el crudo)", () => {
    // Un gasto calculado tiene convertedAmountCents negativo; la contribución debe ser +5000 en expense.
    const item = makeItem("EXPENSE", -5000);
    // amountCents === convertedAmountCents === -5000 para este fixture
    const result = sumMovementTotals([item]);
    expect(result).toEqual({ expense: 5000, income: 0 });
  });

  it("lista mixta: INCOME + EXPENSE normal + EXPENSE calculado negativo", () => {
    const items: MovementItem[] = [
      makeItem("INCOME", 500000, "inc"),
      makeItem("EXPENSE", 15000, "exp"),
      makeItem("EXPENSE", -5000, "calc"),
    ];
    const result = sumMovementTotals(items);
    // expense = 15000 + 5000 = 20000; income = 500000
    expect(result).toEqual({ expense: 20000, income: 500000 });
  });

  it("múltiples INCOME se acumulan correctamente", () => {
    const items: MovementItem[] = [
      makeItem("INCOME", 100000, "i1"),
      makeItem("INCOME", 200000, "i2"),
    ];
    expect(sumMovementTotals(items)).toEqual({ expense: 0, income: 300000 });
  });

  // ── Multi-moneda (Fase 1.2.3) — usa convertedAmountCents, NO amountCents ──

  it("multi-moneda EXPENSE: usa convertedAmountCents, NO amountCents", () => {
    // USD: amountCents=100 (1 USD), convertedAmountCents=120000 (1 USD × $1200 = $1200 ARS)
    // Si el código sumara amountCents, el resultado sería 100 (incorrecto).
    // Si suma convertedAmountCents, el resultado es 120000 (correcto).
    const item = makeItem("EXPENSE", 100, "usd-exp", 120000);
    const result = sumMovementTotals([item]);
    expect(result).toEqual({ expense: 120000, income: 0 });
    // Asegurar que NO usa amountCents
    expect(result.expense).not.toBe(100);
  });

  it("multi-moneda INCOME: usa convertedAmountCents, NO amountCents", () => {
    // USD: amountCents=20000 (200 USD), convertedAmountCents=24000000 (200 USD × $1200 = $240000 ARS)
    const item = makeItem("INCOME", 20000, "usd-inc", 24000000);
    const result = sumMovementTotals([item]);
    expect(result).toEqual({ expense: 0, income: 24000000 });
    expect(result.income).not.toBe(20000);
  });

  it("multi-moneda lista mixta: total refleja moneda convertida", () => {
    // ARS puro: EXPENSE $150 (amountCents=15000, converted=15000)
    // USD: INCOME $200 → $240.000 ARS (amountCents=20000, converted=24000000)
    const arsExpense = makeItem("EXPENSE", 15000, "ars-exp");
    const usdIncome = makeItem("INCOME", 20000, "usd-inc", 24000000);
    const result = sumMovementTotals([arsExpense, usdIncome]);
    expect(result).toEqual({ expense: 15000, income: 24000000 });
  });

  it("multi-moneda EXPENSE calculado con convertedAmountCents negativo: magnitud correcta", () => {
    // Calculado USD: amountCents=-100 (negativo), convertedAmountCents=-120000
    const item = makeItem("EXPENSE", -100, "calc-usd", -120000);
    const result = sumMovementTotals([item]);
    // Debe sumar la magnitud de convertedAmountCents: 120000
    expect(result).toEqual({ expense: 120000, income: 0 });
    // No debe ser 100 (amountCents) ni -120000 (sin abs)
    expect(result.expense).not.toBe(100);
    expect(result.expense).not.toBe(-120000);
  });
});

// ─── groupSubtotalCents ────────────────────────────────────────────────────────

describe("groupSubtotalCents", () => {
  it("lista vacía → 0", () => {
    expect(groupSubtotalCents([])).toBe(0);
  });

  it("solo INCOME → subtotal positivo (magnitud convertida)", () => {
    expect(groupSubtotalCents([makeItem("INCOME", 500000)])).toBe(500000);
  });

  it("solo EXPENSE normal → subtotal negativo (−magnitud convertida)", () => {
    expect(groupSubtotalCents([makeItem("EXPENSE", 15000)])).toBe(-15000);
  });

  it("EXPENSE calculado con convertedAmountCents negativo → subtotal usa la magnitud (no doble negativo)", () => {
    // convertedAmountCents = -5000; debe contribuir como −5000 al subtotal (expense magnitud = 5000).
    expect(groupSubtotalCents([makeItem("EXPENSE", -5000)])).toBe(-5000);
  });

  it("lista mixta: income − expense correctamente (con valores ARS)", () => {
    const items: MovementItem[] = [
      makeItem("INCOME", 500000, "inc"),
      makeItem("EXPENSE", 15000, "exp"),
      makeItem("EXPENSE", -5000, "calc"),
    ];
    // income 500000 − expense (15000+5000) = 480000
    expect(groupSubtotalCents(items)).toBe(480000);
  });

  it("multi-moneda: subtotal usa convertedAmountCents, NO amountCents", () => {
    // USD income: amountCents=20000, converted=24000000
    // ARS expense: amountCents=15000, converted=15000
    // subtotal = 24000000 − 15000 = 23985000 (con conversión)
    // Si usara amountCents: 20000 − 15000 = 5000 (incorrecto)
    const usdIncome = makeItem("INCOME", 20000, "usd-inc", 24000000);
    const arsExpense = makeItem("EXPENSE", 15000, "ars-exp");
    const result = groupSubtotalCents([usdIncome, arsExpense]);
    expect(result).toBe(24000000 - 15000);
    expect(result).not.toBe(20000 - 15000);
  });
});
