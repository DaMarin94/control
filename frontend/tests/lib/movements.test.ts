/**
 * Tests unitarios de lib/movements.ts (RN-019).
 *
 * Verifica que sumMovementTotals y groupSubtotalCents usen Math.abs(amountCents)
 * y no el crudo con signo, especialmente para calculados EXPENSE con amountCents negativo.
 */

import { describe, it, expect } from "vitest";
import { sumMovementTotals, groupSubtotalCents } from "@/lib/movements";
import type { MovementItem } from "@/types/movement";

// ─── Fixtures mínimos ──────────────────────────────────────────────────────────

function makeItem(
  type: "EXPENSE" | "INCOME",
  amountCents: number,
  id = "m1",
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
  };
}

// ─── sumMovementTotals ─────────────────────────────────────────────────────────

describe("sumMovementTotals", () => {
  it("lista vacía → { expense: 0, income: 0 }", () => {
    expect(sumMovementTotals([])).toEqual({ expense: 0, income: 0 });
  });

  it("EXPENSE normal (amountCents positivo) suma su magnitud en expense", () => {
    const result = sumMovementTotals([makeItem("EXPENSE", 15000)]);
    expect(result).toEqual({ expense: 15000, income: 0 });
  });

  it("INCOME normal (amountCents positivo) suma su magnitud en income", () => {
    const result = sumMovementTotals([makeItem("INCOME", 500000)]);
    expect(result).toEqual({ expense: 0, income: 500000 });
  });

  it("EXPENSE calculado con amountCents NEGATIVO suma la magnitud (no el crudo)", () => {
    // Un gasto calculado tiene amountCents negativo; la contribución debe ser +5000 en expense.
    const result = sumMovementTotals([makeItem("EXPENSE", -5000)]);
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
});

// ─── groupSubtotalCents ────────────────────────────────────────────────────────

describe("groupSubtotalCents", () => {
  it("lista vacía → 0", () => {
    expect(groupSubtotalCents([])).toBe(0);
  });

  it("solo INCOME → subtotal positivo (magnitud)", () => {
    expect(groupSubtotalCents([makeItem("INCOME", 500000)])).toBe(500000);
  });

  it("solo EXPENSE normal → subtotal negativo (−magnitud)", () => {
    expect(groupSubtotalCents([makeItem("EXPENSE", 15000)])).toBe(-15000);
  });

  it("EXPENSE calculado con amountCents negativo → subtotal usa la magnitud (no doble negativo)", () => {
    // amountCents = -5000; debe contribuir como −5000 al subtotal (expense magnitud = 5000).
    expect(groupSubtotalCents([makeItem("EXPENSE", -5000)])).toBe(-5000);
  });

  it("lista mixta: income − expense correctamente", () => {
    const items: MovementItem[] = [
      makeItem("INCOME", 500000, "inc"),
      makeItem("EXPENSE", 15000, "exp"),
      makeItem("EXPENSE", -5000, "calc"),
    ];
    // income 500000 − expense (15000+5000) = 480000
    expect(groupSubtotalCents(items)).toBe(480000);
  });
});
