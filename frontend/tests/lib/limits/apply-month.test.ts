/**
 * Tests del cableado de límites en /mes (computeCategoryExpenseTotalsCents,
 * evaluateItemLimitMark) — P2, Fase 1.
 */

import { describe, it, expect } from "vitest";
import { computeCategoryExpenseTotalsCents, evaluateItemLimitMark } from "@/lib/limits/apply-month";
import type { MovementItem } from "@/types/movement";
import type { LimitConfig } from "@/types/limit";

function makeItem(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: overrides.id ?? "item-1",
    origin: "unico",
    type: "EXPENSE",
    amountCents: 10000,
    description: null,
    occurredAt: "2026-06-10T12:00:00.000Z",
    timezone: "America/Argentina/Buenos_Aires",
    installment: null,
    frequency: null,
    startMonth: null,
    endMonth: null,
    skipped: false,
    category: { id: "cat-1", name: "Comida", color: "#E23B3B", scope: "BOTH" },
    paymentMethod: null,
    calculated: null,
    hasCalculated: false,
    currency: "ARS",
    exchangeRate: 1,
    convertedAmountCents: 10000,
    autoDebit: null,
    calculatedChildren: [],
    ...overrides,
  };
}

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "mes.item.monto",
    temporalScope: "all",
    operator: "gt",
    threshold: 100,
    nature: "passive",
    effect: "glyph",
    ...overrides,
  };
}

describe("computeCategoryExpenseTotalsCents", () => {
  it("suma solo ítems EXPENSE por categoría", () => {
    const items = [
      makeItem({ id: "a", type: "EXPENSE", category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" }, convertedAmountCents: 10000 }),
      makeItem({ id: "b", type: "INCOME", category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" }, convertedAmountCents: 50000 }),
      makeItem({ id: "c", type: "EXPENSE", category: { id: "cat-2", name: "Transporte", color: "#000", scope: "BOTH" }, convertedAmountCents: 5000 }),
    ];
    const totals = computeCategoryExpenseTotalsCents(items);
    expect(totals.get("cat-1")).toBe(10000);
    expect(totals.get("cat-2")).toBe(5000);
  });

  it("excluye ítems anulados (skipped=true)", () => {
    const items = [
      makeItem({ id: "a", skipped: true, convertedAmountCents: 10000 }),
      makeItem({ id: "b", skipped: false, convertedAmountCents: 5000 }),
    ];
    const totals = computeCategoryExpenseTotalsCents(items);
    expect(totals.get("cat-1")).toBe(5000);
  });

  it("usa Math.abs() — calculados EXPENSE con convertedAmountCents negativo", () => {
    const items = [makeItem({ convertedAmountCents: -15000 })];
    const totals = computeCategoryExpenseTotalsCents(items);
    expect(totals.get("cat-1")).toBe(15000);
  });

  it("devuelve un Map vacío para un array vacío", () => {
    expect(computeCategoryExpenseTotalsCents([]).size).toBe(0);
  });
});

describe("evaluateItemLimitMark", () => {
  it("null si ningún límite cruza", () => {
    const item = makeItem({ convertedAmountCents: 5000 }); // $50
    const mark = evaluateItemLimitMark(item, [makeLimit({ threshold: 1000 })], new Map(), true);
    expect(mark).toBeNull();
  });

  it("evalúa mes.item.monto en pesos (convertedAmountCents / 100)", () => {
    const item = makeItem({ convertedAmountCents: 500000 }); // $5000
    const mark = evaluateItemLimitMark(
      item,
      [makeLimit({ anchorKey: "mes.item.monto", threshold: 1000, effect: "badge" })],
      new Map(),
      true,
    );
    expect(mark?.effect).toBe("badge");
  });

  it("un límite mes.item.monto CON categoryId solo aplica a esa categoría", () => {
    const itemCat1 = makeItem({ convertedAmountCents: 500000, category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" } });
    const itemCat2 = makeItem({ convertedAmountCents: 500000, category: { id: "cat-2", name: "Transporte", color: "#000", scope: "BOTH" } });
    const limits = [
      makeLimit({ anchorKey: "mes.item.monto", threshold: 1000, refinement: { categoryId: "cat-1" } }),
    ];
    expect(evaluateItemLimitMark(itemCat1, limits, new Map(), true)).not.toBeNull();
    expect(evaluateItemLimitMark(itemCat2, limits, new Map(), true)).toBeNull();
  });

  it("mes.categoria.gastoMes usa el total de categoría, no el monto del ítem", () => {
    const item = makeItem({ convertedAmountCents: 100, category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" } }); // $1 propio
    const categoryTotals = new Map([["cat-1", 500000]]); // $5000 acumulado de la categoría
    const limits = [
      makeLimit({
        anchorKey: "mes.categoria.gastoMes",
        threshold: 1000,
        refinement: { categoryId: "cat-1" },
        effect: "fill",
      }),
    ];
    const mark = evaluateItemLimitMark(item, limits, categoryTotals, true);
    expect(mark?.effect).toBe("fill");
  });

  it("mes.categoria.gastoMes NO se evalúa sobre ítems INCOME", () => {
    const incomeItem = makeItem({ type: "INCOME", category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" } });
    const categoryTotals = new Map([["cat-1", 500000]]);
    const limits = [
      makeLimit({ anchorKey: "mes.categoria.gastoMes", threshold: 1000, refinement: { categoryId: "cat-1" } }),
    ];
    expect(evaluateItemLimitMark(incomeItem, limits, categoryTotals, true)).toBeNull();
  });

  it("combina mes.item.monto y mes.categoria.gastoMes cuando ambos cruzan (la marca más fuerte gana)", () => {
    const item = makeItem({ convertedAmountCents: 500000, category: { id: "cat-1", name: "Comida", color: "#000", scope: "BOTH" } });
    const categoryTotals = new Map([["cat-1", 1000000]]);
    const limits = [
      makeLimit({ id: "item-limit", anchorKey: "mes.item.monto", threshold: 100, effect: "glyph" }),
      makeLimit({
        id: "cat-limit",
        anchorKey: "mes.categoria.gastoMes",
        threshold: 100,
        refinement: { categoryId: "cat-1" },
        effect: "fill",
      }),
    ];
    const mark = evaluateItemLimitMark(item, limits, categoryTotals, true);
    expect(mark?.effect).toBe("fill");
    expect(mark?.matched.map((l) => l.id).sort()).toEqual(["cat-limit", "item-limit"]);
  });
});
