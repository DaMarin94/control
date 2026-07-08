/**
 * Tests del catálogo de keys de Límites (lib/limits/catalog.ts) — P2, Fase 1.
 */

import { describe, it, expect } from "vitest";
import {
  getAnchorDef,
  getPanelAnchors,
  getPanelAnchorsBySurface,
  formatThreshold,
  formatCondition,
  deriveLimitLabel,
} from "@/lib/limits/catalog";

describe("getAnchorDef", () => {
  it("devuelve la definición de una key conocida", () => {
    expect(getAnchorDef("mes.total.gasto")?.label).toBe("Gasto del mes");
  });

  it("devuelve undefined para una key desconocida", () => {
    expect(getAnchorDef("no.existe")).toBeUndefined();
  });
});

describe("getPanelAnchors / getPanelAnchorsBySurface — alcance Tramo 2", () => {
  it("ofrece las 7 keys mes.* + las 15 keys de reportes/dashboard-widget (22 en total)", () => {
    const offered = getPanelAnchors();
    expect(offered).toHaveLength(22);
    expect(offered.map((a) => a.key).sort()).toEqual(
      [
        // Vista del mes
        "mes.balance",
        "mes.categoria.gastoMes",
        "mes.item.monto",
        "mes.seccion.conteo",
        "mes.seccion.subtotal",
        "mes.total.gasto",
        "mes.total.ingreso",
        // income-expense
        "reporte.ie.gastoMes",
        "reporte.ie.ingresoMes",
        // by-category
        "reporte.cat.gastoMesCategoria",
        "reporte.cat.gastoMesTotal",
        // unique-grid
        "reporte.unicos.celda",
        "reporte.unicos.mesTotal",
        "reporte.unicos.promedioDiario",
        "reporte.unicos.pctVsPrev",
        "reporte.unicos.inflacionMes",
        "reporte.unicos.pctVsPrevAjustado",
        // installment-gantt
        "reporte.cuotas.montoPorCuota",
        "reporte.cuotas.cantidadCuotas",
        // inflation-income
        "reporte.infl.inflacionMes",
        "reporte.infl.ingresoVarMes",
        "reporte.infl.ingresoVarAjustado",
      ].sort(),
    );
  });

  it("agrupa por superficie — las 6 superficies tienen entradas", () => {
    const groups = getPanelAnchorsBySurface();
    expect(groups).toHaveLength(6);
    expect(groups.map((g) => g.surface)).toEqual([
      "mes",
      "reporte-income-expense",
      "reporte-by-category",
      "reporte-unique-grid",
      "reporte-installment-gantt",
      "reporte-inflation-income",
    ]);
    expect(groups.find((g) => g.surface === "mes")?.anchors).toHaveLength(7);
    expect(groups.find((g) => g.surface === "reporte-income-expense")?.anchors).toHaveLength(2);
    expect(groups.find((g) => g.surface === "reporte-by-category")?.anchors).toHaveLength(2);
    expect(groups.find((g) => g.surface === "reporte-unique-grid")?.anchors).toHaveLength(6);
    expect(groups.find((g) => g.surface === "reporte-installment-gantt")?.anchors).toHaveLength(2);
    expect(groups.find((g) => g.surface === "reporte-inflation-income")?.anchors).toHaveLength(3);
  });
});

describe("formatThreshold", () => {
  it("money: agrupación de miles es-AR, sin símbolo de moneda", () => {
    expect(formatThreshold("money", 300000)).toBe("300.000");
  });

  it("percent: sufijo %", () => {
    expect(formatThreshold("percent", 12.5)).toBe("12,5%");
  });

  it("count: entero + sustantivo neutro 'ítems'", () => {
    expect(formatThreshold("count", 5)).toBe("5 ítems");
  });

  it("signed-money: mismo formato que money, sin signo propio", () => {
    expect(formatThreshold("signed-money", -50000)).toBe("-50.000");
  });
});

describe("formatCondition", () => {
  it("arma '{símbolo} {umbral}'", () => {
    expect(formatCondition("money", "gt", 300000)).toBe("> 300.000");
    expect(formatCondition("percent", "lte", 10)).toBe("≤ 10%");
    expect(formatCondition("count", "eq", 3)).toBe("= 3 ítems");
  });
});

describe("deriveLimitLabel", () => {
  it("combina el rótulo legible de la key + la condición", () => {
    expect(deriveLimitLabel("mes.total.gasto", "gt", 300000)).toBe("Gasto del mes > 300.000");
  });

  it("usa la key cruda si no está en el catálogo (defensivo)", () => {
    expect(deriveLimitLabel("key.inexistente", "gt", 100)).toBe("key.inexistente > 100");
  });
});
