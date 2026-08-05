/**
 * Tests del motor de proyección de límites ACTIVOS (P2 — Fase 2).
 *
 * Cubre D13 (mes de proyección — resuelto por el llamador, este motor solo
 * recibe los agregados ya del mes correcto), D14 (qué anclajes mueve cada
 * movimiento — incluida la asimetría gasto/ingreso), D15 (edición reemplaza),
 * D16 (anulado no proyecta), D17 (conversión a canónico), D18 (cruces
 * múltiples) y D19 (mes.item.monto directo, mes.seccion.conteo +1).
 */

import { describe, it, expect } from "vitest";
import {
  projectActiveLimitCrossings,
  toCanonicalAmountCents,
  type MonthRawMovements,
  type ProjectedMovement,
} from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import type { MovementItem } from "@/types/movement";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: "item-1",
    origin: "unico",
    type: "EXPENSE",
    amountCents: 10000,
    description: null,
    occurredAt: "2026-06-01T12:00:00.000Z",
    timezone: "America/Argentina/Buenos_Aires",
    installment: null,
    frequency: null,
    startMonth: null,
    endMonth: null,
    skipped: false,
    category: { id: "cat-1", name: "Comida", color: "#FF5733", scope: "EXPENSE" },
    paymentMethod: null,
    calculated: null,
    hasCalculated: false,
    currency: "ARS",
    exchangeRate: 1,
    convertedAmountCents: 10000,
    autoDebit: null,
    simulated: false,
    calculatedChildren: [],
    ...overrides,
  };
}

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: "limit-1",
    enabled: true,
    anchorKey: "mes.total.gasto",
    operator: "gt",
    threshold: 100,
    nature: "active",
    ...overrides,
  };
}

function emptyMonth(): MonthRawMovements {
  return { unicos: [], fijos: [], cuotas: [] };
}

function movement(overrides: Partial<ProjectedMovement> = {}): ProjectedMovement {
  return {
    type: "EXPENSE",
    convertedAmountCents: 20000,
    categoryId: "cat-1",
    section: "unicos",
    skipped: false,
    ...overrides,
  };
}

// ─── toCanonicalAmountCents (D17) ──────────────────────────────────────────────

describe("toCanonicalAmountCents", () => {
  it("devuelve el monto sin cambios cuando currency === defaultCurrency", () => {
    expect(toCanonicalAmountCents(10000, "ARS", "ARS", 1)).toBe(10000);
  });

  it("convierte multiplicando por exchangeRate cuando currency !== defaultCurrency", () => {
    expect(toCanonicalAmountCents(1000, "USD", "ARS", 1350)).toBe(1350000);
  });

  it("redondea el resultado (evita decimales flotantes)", () => {
    expect(toCanonicalAmountCents(333, "USD", "ARS", 1.005)).toBe(Math.round(333 * 1.005));
  });
});

// ─── Cero fricción / D16 ────────────────────────────────────────────────────────

describe("projectActiveLimitCrossings — cero fricción y D16", () => {
  it("devuelve [] si el array de límites está vacío", () => {
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), []);
    expect(result).toEqual([]);
  });

  it("devuelve [] si no hay límites ACTIVOS habilitados (solo pasivos)", () => {
    const limits = [makeLimit({ nature: "passive", temporalScope: "all", threshold: 1 })];
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("devuelve [] si el límite activo está deshabilitado", () => {
    const limits = [makeLimit({ enabled: false, threshold: 1 })];
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("D16: un movimiento que se guarda/edita YA anulado no proyecta (devuelve [] aunque cruzaría)", () => {
    const limits = [makeLimit({ threshold: 1 })]; // cruzaría con cualquier monto > 1
    const result = projectActiveLimitCrossings(movement({ skipped: true }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });
});

// ─── D14 — qué anclajes mueve cada movimiento ─────────────────────────────────

describe("projectActiveLimitCrossings — D14 (gasto)", () => {
  it("un gasto cruza mes.total.gasto cuando el total proyectado supera el umbral", () => {
    const limits = [makeLimit({ id: "l-gasto", anchorKey: "mes.total.gasto", operator: "gt", threshold: 150 })];
    // 20000 centavos = $200 > $150
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE" }), emptyMonth(), limits);
    expect(result.map((l) => l.id)).toEqual(["l-gasto"]);
  });

  it("un gasto NO cruza mes.total.gasto si el total proyectado no supera el umbral", () => {
    const limits = [makeLimit({ anchorKey: "mes.total.gasto", operator: "gt", threshold: 1000 })];
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE" }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("un gasto cruza mes.balance (piso) cuando el balance proyectado cae por debajo del umbral", () => {
    const limits = [makeLimit({ id: "l-bal", anchorKey: "mes.balance", operator: "lt", threshold: 0 })];
    // Sin ingresos, un gasto de $200 deja balance en -200 < 0
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE" }), emptyMonth(), limits);
    expect(result.map((l) => l.id)).toEqual(["l-bal"]);
  });

  it("un gasto cruza mes.seccion.subtotal + mes.seccion.conteo de SU sección", () => {
    const limits = [
      makeLimit({ id: "l-sub", anchorKey: "mes.seccion.subtotal", operator: "lt", threshold: -100, refinement: { section: "unicos" } }),
      makeLimit({ id: "l-cnt", anchorKey: "mes.seccion.conteo", operator: "gt", threshold: 0, refinement: { section: "unicos" } }),
    ];
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE", section: "unicos" }), emptyMonth(), limits);
    expect(result.map((l) => l.id).sort()).toEqual(["l-cnt", "l-sub"]);
  });

  it("el refinamiento de sección NO dispara si no coincide con la sección del movimiento", () => {
    const limits = [
      makeLimit({ anchorKey: "mes.seccion.subtotal", operator: "lt", threshold: 100000, refinement: { section: "fijos" } }),
    ];
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE", section: "unicos" }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("un gasto cruza mes.categoria.gastoMes de SU categoría (agregado sobre TODAS las secciones)", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "u1", type: "EXPENSE", category: { id: "cat-1", name: "Comida", color: "#f00", scope: "EXPENSE" }, convertedAmountCents: 5000 })],
      fijos: [makeItem({ id: "f1", type: "EXPENSE", category: { id: "cat-1", name: "Comida", color: "#f00", scope: "EXPENSE" }, convertedAmountCents: 3000 })],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-cat", anchorKey: "mes.categoria.gastoMes", operator: "gt", threshold: 250, refinement: { categoryId: "cat-1" } })];
    // Base categoría = 5000+3000 = 8000 centavos ($80) + nuevo gasto $200 = $280 > $250
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE", categoryId: "cat-1" }), monthRaw, limits);
    expect(result.map((l) => l.id)).toEqual(["l-cat"]);
  });

  it("mes.categoria.gastoMes NO dispara para una categoría distinta a la del movimiento", () => {
    const limits = [makeLimit({ anchorKey: "mes.categoria.gastoMes", operator: "gt", threshold: 1, refinement: { categoryId: "cat-OTRA" } })];
    const result = projectActiveLimitCrossings(movement({ type: "EXPENSE", categoryId: "cat-1" }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });
});

describe("projectActiveLimitCrossings — D14 (ingreso: SOLO total.ingreso y balance)", () => {
  it("un ingreso cruza mes.total.ingreso y mes.balance", () => {
    const limits = [
      makeLimit({ id: "l-ing", anchorKey: "mes.total.ingreso", operator: "lt", threshold: 300, temporalScope: undefined }),
      makeLimit({ id: "l-bal", anchorKey: "mes.balance", operator: "gt", threshold: 0 }),
    ];
    // Ingreso de $200 < $300 (piso) y balance +$200 > 0
    const result = projectActiveLimitCrossings(movement({ type: "INCOME" }), emptyMonth(), limits);
    expect(result.map((l) => l.id).sort()).toEqual(["l-bal", "l-ing"]);
  });

  it("un ingreso NO dispara mes.seccion.subtotal ni mes.seccion.conteo ni mes.categoria.gastoMes (D14, cierre literal)", () => {
    const limits = [
      makeLimit({ anchorKey: "mes.seccion.subtotal", operator: "gt", threshold: -1000000, refinement: { section: "unicos" } }),
      makeLimit({ anchorKey: "mes.seccion.conteo", operator: "gt", threshold: 0, refinement: { section: "unicos" } }),
      makeLimit({ anchorKey: "mes.categoria.gastoMes", operator: "gt", threshold: -1000000, refinement: { categoryId: "cat-1" } }),
    ];
    const result = projectActiveLimitCrossings(movement({ type: "INCOME", section: "unicos", categoryId: "cat-1" }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("mes.item.monto SÍ es universal — dispara también para un ingreso (D19, resolución de ambigüedad)", () => {
    const limits = [makeLimit({ id: "l-item", anchorKey: "mes.item.monto", operator: "gt", threshold: 150 })];
    const result = projectActiveLimitCrossings(movement({ type: "INCOME" }), emptyMonth(), limits);
    expect(result.map((l) => l.id)).toEqual(["l-item"]);
  });
});

// ─── D19 — keys especiales ──────────────────────────────────────────────────────

describe("projectActiveLimitCrossings — D19 (mes.item.monto directo, sin acumular)", () => {
  it("mes.item.monto evalúa el monto de ESTE movimiento, no un acumulado", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "u1", convertedAmountCents: 900000 })], // acumulado grande preexistente
      fijos: [],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-item", anchorKey: "mes.item.monto", operator: "gt", threshold: 500 })];
    // El movimiento nuevo es de $200 — no supera $500 por sí solo, aunque el total acumulado sea gigante
    const result = projectActiveLimitCrossings(movement({ convertedAmountCents: 20000 }), monthRaw, limits);
    expect(result).toEqual([]);
  });

  it("mes.item.monto respeta el refinamiento OPCIONAL de categoría", () => {
    const limits = [makeLimit({ anchorKey: "mes.item.monto", operator: "gt", threshold: 1, refinement: { categoryId: "cat-OTRA" } })];
    const result = projectActiveLimitCrossings(movement({ categoryId: "cat-1" }), emptyMonth(), limits);
    expect(result).toEqual([]);
  });

  it("mes.item.monto SIN refinamiento aplica a cualquier categoría (universal)", () => {
    const limits = [makeLimit({ id: "l-item", anchorKey: "mes.item.monto", operator: "gt", threshold: 1 })];
    const result = projectActiveLimitCrossings(movement({ categoryId: "cat-cualquiera" }), emptyMonth(), limits);
    expect(result.map((l) => l.id)).toEqual(["l-item"]);
  });
});

describe("projectActiveLimitCrossings — D19 (mes.seccion.conteo proyecta conteo actual + 1)", () => {
  it("proyecta el conteo actual de la sección + 1 (este movimiento)", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "u1" }), makeItem({ id: "u2" })],
      fijos: [],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-cnt", anchorKey: "mes.seccion.conteo", operator: "gte", threshold: 3, refinement: { section: "unicos" } })];
    // 2 existentes + 1 nuevo = 3, cruza gte 3
    const result = projectActiveLimitCrossings(movement({ section: "unicos" }), monthRaw, limits);
    expect(result.map((l) => l.id)).toEqual(["l-cnt"]);
  });

  it("el conteo incluye ítems anulados (mismo criterio que la marca pasiva)", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "u1", skipped: true }), makeItem({ id: "u2" })],
      fijos: [],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-cnt", anchorKey: "mes.seccion.conteo", operator: "gte", threshold: 3, refinement: { section: "unicos" } })];
    const result = projectActiveLimitCrossings(movement({ section: "unicos" }), monthRaw, limits);
    expect(result.map((l) => l.id)).toEqual(["l-cnt"]);
  });
});

// ─── D15 — edición reemplaza, no suma ──────────────────────────────────────────

describe("projectActiveLimitCrossings — D15 (edición reemplaza)", () => {
  it("al editar, excluye la contribución PREVIA del movimiento antes de sumar la nueva", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "editing-me", type: "EXPENSE", convertedAmountCents: 10000 })], // $100 ya contado
      fijos: [],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-gasto", anchorKey: "mes.total.gasto", operator: "gt", threshold: 250 })];

    // Reemplaza el monto de $100 por $200 (editingId="editing-me") — proyectado = $200, NO $300 (suma incorrecta)
    const result = projectActiveLimitCrossings(
      movement({ convertedAmountCents: 20000, editingId: "editing-me" }),
      monthRaw,
      limits,
    );
    expect(result).toEqual([]); // $200 no supera $250
  });

  it("sin editingId (creación), la contribución previa NO se excluye — se suma sobre la base completa", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "otro-item", type: "EXPENSE", convertedAmountCents: 10000 })], // $100
      fijos: [],
      cuotas: [],
    };
    const limits = [makeLimit({ id: "l-gasto", anchorKey: "mes.total.gasto", operator: "gt", threshold: 250 })];
    // Creación nueva de $200 + $100 existente = $300 > $250
    const result = projectActiveLimitCrossings(movement({ convertedAmountCents: 20000 }), monthRaw, limits);
    expect(result.map((l) => l.id)).toEqual(["l-gasto"]);
  });

  it("editingId excluye también de mes.categoria.gastoMes y mes.seccion.conteo", () => {
    const monthRaw: MonthRawMovements = {
      unicos: [makeItem({ id: "editing-me", type: "EXPENSE", category: { id: "cat-1", name: "Comida", color: "#f00", scope: "EXPENSE" }, convertedAmountCents: 5000 })],
      fijos: [],
      cuotas: [],
    };
    const limits = [
      makeLimit({ id: "l-cat", anchorKey: "mes.categoria.gastoMes", operator: "gt", threshold: 150, refinement: { categoryId: "cat-1" } }),
      makeLimit({ id: "l-cnt", anchorKey: "mes.seccion.conteo", operator: "gt", threshold: 1, refinement: { section: "unicos" } }),
    ];
    // Editando el ÚNICO ítem existente: conteo proyectado = 0 (excluido) + 1 = 1, NO > 1 → no cruza
    // Categoría proyectada = 0 (excluido) + $200 nuevo = $200 > $150 → cruza
    const result = projectActiveLimitCrossings(
      movement({ convertedAmountCents: 20000, categoryId: "cat-1", editingId: "editing-me" }),
      monthRaw,
      limits,
    );
    expect(result.map((l) => l.id)).toEqual(["l-cat"]);
  });
});

// ─── D18 — cruces múltiples ─────────────────────────────────────────────────────

describe("projectActiveLimitCrossings — D18 (enumera TODOS los cruces)", () => {
  it("devuelve todos los límites activos que cruzan, de distintos anclajes", () => {
    const limits = [
      makeLimit({ id: "l-gasto", anchorKey: "mes.total.gasto", operator: "gt", threshold: 1 }),
      makeLimit({ id: "l-bal", anchorKey: "mes.balance", operator: "lt", threshold: 1000000 }),
      makeLimit({ id: "l-item", anchorKey: "mes.item.monto", operator: "gt", threshold: 1 }),
    ];
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), limits);
    expect(result.map((l) => l.id).sort()).toEqual(["l-bal", "l-gasto", "l-item"]);
  });

  it("un límite deshabilitado no se incluye aunque cruzaría", () => {
    const limits = [
      makeLimit({ id: "l-on", anchorKey: "mes.total.gasto", operator: "gt", threshold: 1 }),
      makeLimit({ id: "l-off", anchorKey: "mes.item.monto", operator: "gt", threshold: 1, enabled: false }),
    ];
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), limits);
    expect(result.map((l) => l.id)).toEqual(["l-on"]);
  });

  it("un límite de naturaleza 'passive' no se evalúa acá (evaluador write-path exclusivo de 'active')", () => {
    const limits = [makeLimit({ nature: "passive", anchorKey: "mes.total.gasto", operator: "gt", threshold: 1, temporalScope: "all" })];
    // No hay NINGÚN límite activo → cero fricción, ni se construyen agregados
    const result = projectActiveLimitCrossings(movement(), emptyMonth(), limits);
    expect(result).toEqual([]);
  });
});
