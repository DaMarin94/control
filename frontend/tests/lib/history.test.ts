/**
 * Tests unitarios de lib/history.ts (docs/design.md §"Historial de cambios
 * (`/historial`)" §3, §5).
 *
 * Verifica el corazón funcional de la pantalla: el mapeo de un
 * `HistoryChangeDto` (contrato de GET /history) a su presentación —
 * dirección `list` vs `modal` (espejo del par), promoción del monto, color
 * por tipo, verbo de `autoDebit`, unidad de `installments` una sola vez, y el
 * discriminador `"next" in change` (nunca `next === null`).
 */

import { describe, it, expect } from "vitest";
import {
  describeHistoryChange,
  formatHistoryAmount,
  formatHistoryFormula,
  formatHistoryMoment,
  summarizeHistoryChange,
  pickSummaryChange,
  getHistoryEntryName,
  HISTORY_FIELD_LABELS,
  HISTORY_TARGET_KIND_LABEL,
} from "@/lib/history";
import type { HistoryChangeDto, HistoryEntryResponseDto } from "@/types/history";

describe("formatHistoryAmount", () => {
  it("gasto: signo − y color text-ink", () => {
    const result = formatHistoryAmount({ amountCents: 150000, currency: "ARS", type: "EXPENSE" });
    expect(result.text).toBe("−$1.500,00");
    expect(result.colorClass).toBe("text-ink");
  });

  it("ingreso: signo + y color text-income-ink", () => {
    const result = formatHistoryAmount({ amountCents: 150000, currency: "ARS", type: "INCOME" });
    expect(result.text).toBe("+$1.500,00");
    expect(result.colorClass).toBe("text-income-ink");
  });
});

describe("formatHistoryFormula", () => {
  it("PCT con signo negativo — forma abstracta, sin cifra de origen", () => {
    // operand escalado: 10% → 1000 (×100, ver descaleOperand)
    const text = formatHistoryFormula({ operator: "PCT", operand: 1000, sign: -1, currency: "ARS" });
    expect(text).toContain("−");
    expect(text).toContain("10");
    expect(text).not.toMatch(/\$/); // sin cifra de origen: nunca formatea un monto en PCT
  });

  it("ADD con signo positivo — usa la moneda PROPIA del calculado (value.currency) para el operando", () => {
    // operand escalado: $500 → 50000 centavos (÷100, ver descaleOperand)
    const text = formatHistoryFormula({ operator: "ADD", operand: 50000, sign: 1, currency: "USD" });
    expect(text.startsWith("+")).toBe(true);
    expect(text).toContain("US$500,00");
  });
});

describe("formatHistoryMoment", () => {
  it("formatea día + mes abreviado (sin año) · hora, mono-friendly", () => {
    const text = formatHistoryMoment("2026-06-02T17:30:00.000Z", "America/Argentina/Buenos_Aires");
    expect(text).toBe("02 Jun · 14:30");
  });
});

describe("HISTORY_FIELD_LABELS / HISTORY_TARGET_KIND_LABEL", () => {
  it("cubre los 12 campos del contrato", () => {
    expect(Object.keys(HISTORY_FIELD_LABELS)).toHaveLength(12);
    expect(HISTORY_FIELD_LABELS.amount).toBe("Monto");
    expect(HISTORY_FIELD_LABELS.autoDebit).toBe("Débito automático");
  });

  it("mapea targetKind a la etiqueta de estructura", () => {
    expect(HISTORY_TARGET_KIND_LABEL.UNICO).toBe("Único");
    expect(HISTORY_TARGET_KIND_LABEL.FIJO).toBe("Fijo");
    expect(HISTORY_TARGET_KIND_LABEL.CUOTA).toBe("Cuotas");
  });
});

describe("describeHistoryChange — campo `amount`", () => {
  const change: HistoryChangeDto = {
    field: "amount",
    previous: { amountCents: 100000, currency: "ARS", type: "EXPENSE" },
    next: { amountCents: 150000, currency: "ARS", type: "EXPENSE" },
  };

  it("lista (previous → next): izquierda muted, derecha coloreada por tipo, SIEMPRE promovido", () => {
    const d = describeHistoryChange(change, "list");
    expect(d.leftText).toBe("−$1.000,00");
    expect(d.rightText).toBe("−$1.500,00");
    expect(d.rightColorClass).toBe("text-ink");
    expect(d.promoted).toBe(true);
    expect(d.mono).toBe(true);
  });

  it("modal (next → previous): el par se invierte — es el espejo de la fila", () => {
    const d = describeHistoryChange(change, "modal");
    expect(d.leftText).toBe("−$1.500,00"); // el actual (next de la entrada)
    expect(d.rightText).toBe("−$1.000,00"); // el restaurado (previous de la entrada)
  });

  it("eliminación (sin next): modo de valor único, sin par, color por tipo igual", () => {
    const stateChange: HistoryChangeDto = {
      field: "amount",
      previous: { amountCents: 80000, currency: "ARS", type: "INCOME" },
    };
    const d = describeHistoryChange(stateChange, "list");
    expect(d.leftText).toBeNull();
    expect(d.rightText).toBe("+$800,00");
    expect(d.rightColorClass).toBe("text-income-ink");
    expect(d.isState).toBe(true);
  });
});

describe("describeHistoryChange — campo `installments`", () => {
  it("la unidad 'cuotas' aparece UNA sola vez, en el valor que gana", () => {
    const change: HistoryChangeDto = { field: "installments", previous: 6, next: 12 };
    const d = describeHistoryChange(change, "list");
    expect(d.leftText).toBe("6");
    expect(d.rightText).toBe("12 cuotas");
  });

  it("singular cuando el valor nuevo es 1", () => {
    const change: HistoryChangeDto = { field: "installments", previous: 12, next: 1 };
    const d = describeHistoryChange(change, "list");
    expect(d.rightText).toBe("1 cuota");
  });
});

describe("describeHistoryChange — campo `autoDebit`", () => {
  it("edición, lista: verbo pasado según `next`", () => {
    const activated: HistoryChangeDto = { field: "autoDebit", previous: false, next: true };
    expect(describeHistoryChange(activated, "list").rightText).toBe("Se activó");
    expect(describeHistoryChange(activated, "list").leftText).toBeNull();

    const deactivated: HistoryChangeDto = { field: "autoDebit", previous: true, next: false };
    expect(describeHistoryChange(deactivated, "list").rightText).toBe("Se desactivó");
  });

  it("edición, modal: verbo presente INVERTIDO según `previous` (lo que va a quedar)", () => {
    const activated: HistoryChangeDto = { field: "autoDebit", previous: false, next: true };
    // Lista dice "Se activó" → modal dice "Se desactiva" (vuelve a false)
    expect(describeHistoryChange(activated, "modal").rightText).toBe("Se desactiva");
  });

  it("eliminación (state): palabra de estado, nunca el verbo de transición", () => {
    const change: HistoryChangeDto = { field: "autoDebit", previous: true };
    const d = describeHistoryChange(change, "list");
    expect(d.rightText).toBe("Activado");
    expect(d.leftText).toBeNull();
  });
});

describe("describeHistoryChange — campo `description` (null es un valor legítimo)", () => {
  it("discrimina 'sin par' de 'valor null' — nunca usa next === null como sentinel", () => {
    const editChange: HistoryChangeDto = { field: "description", previous: null, next: "Nuevo texto" };
    const d = describeHistoryChange(editChange, "list");
    expect(d.leftText).toBe("—"); // valor previo null → em dash, PERO el par SÍ existe
    expect(d.rightText).toBe("Nuevo texto");

    const stateChange: HistoryChangeDto = { field: "description", previous: null };
    const s = describeHistoryChange(stateChange, "list");
    expect(s.leftText).toBeNull(); // sin par: modo de valor único
    expect(s.rightText).toBe("—");
  });
});

describe("describeHistoryChange — campo `paymentMethod` (null es un valor legítimo)", () => {
  it("valor null en el par se muestra como em dash, no rompe el discriminador", () => {
    const change: HistoryChangeDto = {
      field: "paymentMethod",
      previous: { id: "pm-1", name: "Visa" },
      next: null,
    };
    const d = describeHistoryChange(change, "list");
    expect(d.leftText).toBe("Visa");
    expect(d.rightText).toBe("—");
  });
});

describe("describeHistoryChange — campo `category`", () => {
  it("expone el color de cada lado por separado (identidad, no tono)", () => {
    const change: HistoryChangeDto = {
      field: "category",
      previous: { id: "c1", name: "Comida", color: "#FF0000" },
      next: { id: "c2", name: "Salud", color: "#00FF00" },
    };
    const d = describeHistoryChange(change, "list");
    expect(d.leftDotColor).toBe("#FF0000");
    expect(d.rightDotColor).toBe("#00FF00");
    expect(d.truncatable).toBe(true);
  });
});

describe("describeHistoryChange — campo `type`", () => {
  it("nunca colorea la palabra (rightColorClass ausente)", () => {
    const change: HistoryChangeDto = { field: "type", previous: "EXPENSE", next: "INCOME" };
    const d = describeHistoryChange(change, "list");
    expect(d.leftText).toBe("Gasto");
    expect(d.rightText).toBe("Ingreso");
    expect(d.rightColorClass).toBeUndefined();
  });
});

describe("describeHistoryChange — campo `formula`", () => {
  it("ADD/SUB: el operando usa la moneda PROPIA del calculado (value.currency)", () => {
    const change: HistoryChangeDto = {
      field: "formula",
      previous: { operator: "ADD", operand: 50000, sign: 1, currency: "ARS" },
      next: { operator: "ADD", operand: 80000, sign: 1, currency: "ARS" },
    };
    const d = describeHistoryChange(change, "list");
    expect(d.leftText).toBe("+origen + $500,00");
    expect(d.rightText).toBe("+origen + $800,00");
  });

  it("el calculado en moneda DISTINTA de la default del usuario renderiza el operando con SU moneda, no con la default", () => {
    // El usuario tiene ARS de default (implícito: no se le pasa a describeHistoryChange), pero
    // el calculado está en USD — el operando tiene que salir con símbolo "US$", nunca con "$" a secas.
    const change: HistoryChangeDto = {
      field: "formula",
      previous: { operator: "ADD", operand: 50000, sign: 1, currency: "USD" },
    };
    const d = describeHistoryChange(change, "list");
    // Símbolo de USD ("US$"), nunca el de ARS a secas ("$") — confirma que usa
    // `value.currency` del calculado, no una moneda default asumida por fuera.
    expect(d.rightText).toContain("US$500,00");
  });

  it("MUL/DIV/PCT: el operando nunca formatea moneda, sea cual sea `currency`", () => {
    const change: HistoryChangeDto = {
      field: "formula",
      previous: { operator: "MUL", operand: 1_500_000, sign: 1, currency: "USD" },
    };
    const d = describeHistoryChange(change, "list");
    expect(d.rightText).not.toMatch(/\$/);
    expect(d.rightText).toContain("1,5");
  });
});

describe("describeHistoryChange — campos no-monto nunca se promueven", () => {
  it.each<HistoryChangeDto>([
    { field: "exchangeRate", previous: 1180.5, next: 1245 },
    { field: "installments", previous: 6, next: 12 },
    {
      field: "formula",
      previous: { operator: "PCT", operand: 1000, sign: 1, currency: "ARS" },
      next: { operator: "PCT", operand: 1500, sign: 1, currency: "ARS" },
    },
  ])("field=%s → promoted=false", (change) => {
    expect(describeHistoryChange(change, "list").promoted).toBe(false);
  });
});

describe("summarizeHistoryChange / pickSummaryChange (modal de cadena, §6.2)", () => {
  it("prioriza el campo `amount` si cambió", () => {
    const changes: HistoryChangeDto[] = [
      { field: "category", previous: { id: "c1", name: "A", color: "#000" }, next: { id: "c2", name: "B", color: "#111" } },
      {
        field: "amount",
        previous: { amountCents: 100000, currency: "ARS", type: "EXPENSE" },
        next: { amountCents: 200000, currency: "ARS", type: "EXPENSE" },
      },
    ];
    const picked = pickSummaryChange(changes);
    expect(picked?.field).toBe("amount");
    // Resumen = UN SOLO VALOR (el resultante), nunca el par anterior → nuevo (§6.2, causa de las cifras cortadas en QA).
    expect(summarizeHistoryChange(picked!)).toEqual({ text: "Monto: −$2.000,00", nowrap: true });
  });

  it("si no cambió el monto, usa el primer campo del orden fijo (el que llega primero en `changes`)", () => {
    const changes: HistoryChangeDto[] = [
      { field: "description", previous: "Antes", next: "Después" },
    ];
    const picked = pickSummaryChange(changes);
    expect(picked?.field).toBe("description");
    expect(summarizeHistoryChange(picked!)).toEqual({ text: "Descripción: Después", nowrap: false });
  });

  it("campos de cifra indivisible (cotización, cuotas, fecha, mes de inicio, fórmula) marcan nowrap: true", () => {
    expect(summarizeHistoryChange({ field: "exchangeRate", previous: 1180.5, next: 1245 }).nowrap).toBe(true);
    expect(summarizeHistoryChange({ field: "installments", previous: 6, next: 12 }).nowrap).toBe(true);
    expect(
      summarizeHistoryChange(
        { field: "date", previous: { occurredAt: "2026-06-01T12:00:00.000Z", timezone: "UTC" }, next: { occurredAt: "2026-06-02T12:00:00.000Z", timezone: "UTC" } },
      ).nowrap,
    ).toBe(true);
    expect(
      summarizeHistoryChange({ field: "startMonth", previous: "2024-03", next: "2024-04" }).nowrap,
    ).toBe(true);
    expect(
      summarizeHistoryChange(
        {
          field: "formula",
          previous: { operator: "PCT", operand: 1000, sign: 1, currency: "ARS" },
          next: { operator: "PCT", operand: 1500, sign: -1, currency: "ARS" },
        },
      ).nowrap,
    ).toBe(true);
  });

  it("campos de texto (categoría, moneda, tipo, método de pago) marcan nowrap: false — pueden truncar", () => {
    expect(
      summarizeHistoryChange(
        { field: "category", previous: { id: "c1", name: "A", color: "#000" }, next: { id: "c2", name: "B", color: "#111" } },
      ).nowrap,
    ).toBe(false);
    expect(summarizeHistoryChange({ field: "currency", previous: "ARS", next: "USD" }).nowrap).toBe(false);
    expect(summarizeHistoryChange({ field: "type", previous: "EXPENSE", next: "INCOME" }).nowrap).toBe(false);
  });
});

describe("getHistoryEntryName", () => {
  function makeEntry(overrides: Partial<HistoryEntryResponseDto> = {}): HistoryEntryResponseDto {
    return {
      id: "hist-1",
      targetKind: "UNICO",
      targetId: "tx-1",
      action: "EDIT",
      createdAt: "2026-06-02T17:30:00.000Z",
      description: null,
      category: { id: "cat-1", name: "Alquiler", color: "#FF5733", scope: "EXPENSE" },
      type: "EXPENSE",
      amount: null,
      isCalculated: false,
      changes: [],
      canUndo: true,
      blockingCount: 0,
      ...overrides,
    };
  }

  it("usa la descripción cuando está presente", () => {
    expect(getHistoryEntryName(makeEntry({ description: "Supermercado" }))).toBe("Supermercado");
  });

  it("cae en el nombre de la categoría cuando no hay descripción", () => {
    expect(getHistoryEntryName(makeEntry({ description: null }))).toBe("Alquiler");
  });

  it("cae en 'Movimiento' cuando no hay descripción ni categoría", () => {
    expect(getHistoryEntryName(makeEntry({ description: null, category: null }))).toBe("Movimiento");
  });
});
