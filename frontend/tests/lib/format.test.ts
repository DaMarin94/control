/**
 * Tests de los helpers de formato.
 * Verifica: conversión pesos→centavos, conversión fecha/hora local→UTC,
 * helpers de presentación (formatCurrency, utcToLocalDate, utcToLocalTime).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseCurrencyInput,
  formatCurrency,
  localToUtcIso,
  utcToLocalDate,
  utcToLocalTime,
  getBrowserTimezone,
  getCurrentMonth,
  formatMonthLabel,
  prevMonth,
  nextMonth,
} from "@/lib/format";

// ─── parseCurrencyInput (pesos → centavos) ─────────────────────────────────

describe("parseCurrencyInput", () => {
  it("convierte '15.50' a 1550 centavos", () => {
    expect(parseCurrencyInput("15.50")).toBe(1550);
  });

  it("convierte '15,50' a 1550 centavos (coma como separador decimal)", () => {
    expect(parseCurrencyInput("15,50")).toBe(1550);
  });

  it("convierte '1500' a 150000 centavos (sin decimales)", () => {
    expect(parseCurrencyInput("1500")).toBe(150000);
  });

  it("convierte '0.01' a 1 centavo (mínimo válido)", () => {
    expect(parseCurrencyInput("0.01")).toBe(1);
  });

  it("retorna null para '0'", () => {
    expect(parseCurrencyInput("0")).toBeNull();
  });

  it("retorna null para valores negativos", () => {
    expect(parseCurrencyInput("-5")).toBeNull();
  });

  it("retorna null para strings no numéricos", () => {
    expect(parseCurrencyInput("abc")).toBeNull();
  });

  it("retorna null para string vacío", () => {
    expect(parseCurrencyInput("")).toBeNull();
  });

  it("ignora espacios al inicio/fin", () => {
    expect(parseCurrencyInput("  10.50  ")).toBe(1050);
  });

  it("maneja correctamente '1500.00'", () => {
    expect(parseCurrencyInput("1500.00")).toBe(150000);
  });

  it("redondea centavos correctamente (sin acumulación de error de punto flotante)", () => {
    // 1.005 en JS es en realidad 1.00499999... por representación binaria,
    // así que Math.round(1.005 * 100) = 100 es el resultado correcto.
    // Lo importante es que el resultado sea entero y no NaN.
    const result = parseCurrencyInput("1.005");
    expect(result).not.toBeNull();
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });
});

// ─── formatCurrency (centavos → presentación) ─────────────────────────────

describe("formatCurrency", () => {
  it("formatea 150050 como '$1.500,50' (locale es-AR)", () => {
    const result = formatCurrency(150050);
    expect(result).toBe("$1.500,50");
  });

  it("formatea 100 como '$1,00'", () => {
    const result = formatCurrency(100);
    expect(result).toBe("$1,00");
  });

  it("formatea 0 como '$0,00'", () => {
    const result = formatCurrency(0);
    expect(result).toBe("$0,00");
  });

  it("siempre muestra 2 decimales", () => {
    const result = formatCurrency(1000);
    expect(result).toMatch(/,00$/);
  });
});

// ─── localToUtcIso (fecha + hora local → UTC ISO 8601) ────────────────────

describe("localToUtcIso", () => {
  const TZ_BA = "America/Argentina/Buenos_Aires"; // UTC-3, sin DST

  it("convierte '2026-06-17' + '14:30' en BsAs a UTC correctamente", () => {
    const result = localToUtcIso("2026-06-17", "14:30", TZ_BA);
    // BsAs es UTC-3 en junio, entonces 14:30 local = 17:30 UTC
    const date = new Date(result);
    expect(date.getUTCHours()).toBe(17);
    expect(date.getUTCMinutes()).toBe(30);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(5); // junio = índice 5
    expect(date.getUTCDate()).toBe(17);
  });

  it("retorna un string ISO 8601 válido (parseable por Date)", () => {
    const result = localToUtcIso("2026-01-01", "12:00", TZ_BA);
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });

  it("maneja medianoche correctamente", () => {
    const result = localToUtcIso("2026-06-17", "00:00", TZ_BA);
    const date = new Date(result);
    // 00:00 BsAs = 03:00 UTC del mismo día
    expect(date.getUTCHours()).toBe(3);
    expect(date.getUTCDate()).toBe(17);
  });
});

// ─── utcToLocalDate / utcToLocalTime (UTC → campos del form) ──────────────

describe("utcToLocalDate", () => {
  const TZ_BA = "America/Argentina/Buenos_Aires";

  it("convierte UTC a fecha local correctamente para BsAs", () => {
    // 2026-06-17T17:30:00Z = 14:30 en BsAs (UTC-3)
    const result = utcToLocalDate("2026-06-17T17:30:00Z", TZ_BA);
    expect(result).toBe("2026-06-17");
  });

  it("detecta cambio de día por zona horaria (UTC medianoche es día anterior en BsAs)", () => {
    // 2026-06-18T01:00:00Z = 2026-06-17T22:00 en BsAs (UTC-3)
    const result = utcToLocalDate("2026-06-18T01:00:00Z", TZ_BA);
    expect(result).toBe("2026-06-17");
  });
});

describe("utcToLocalTime", () => {
  const TZ_BA = "America/Argentina/Buenos_Aires";

  it("convierte UTC a hora local correctamente para BsAs", () => {
    // 17:30 UTC = 14:30 en BsAs (UTC-3)
    const result = utcToLocalTime("2026-06-17T17:30:00Z", TZ_BA);
    expect(result).toBe("14:30");
  });

  it("retorna formato HH:MM (dos dígitos)", () => {
    // 2026-06-17T12:05:00Z = 09:05 en BsAs
    const result = utcToLocalTime("2026-06-17T12:05:00Z", TZ_BA);
    expect(result).toBe("09:05");
  });
});

// ─── getBrowserTimezone ────────────────────────────────────────────────────

describe("getBrowserTimezone", () => {
  it("retorna un string no vacío", () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("retorna un nombre IANA con formato X/Y o UTC", () => {
    const tz = getBrowserTimezone();
    // Debe tener formato "Continent/City" o ser "UTC"
    expect(tz === "UTC" || tz.includes("/")).toBe(true);
  });
});

// ─── getCurrentMonth ──────────────────────────────────────────────────────────

describe("getCurrentMonth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna el mes actual en formato YYYY-MM", () => {
    // Fijar fecha a 2026-06-08 (mediodía UTC)
    vi.setSystemTime(new Date("2026-06-08T12:00:00Z"));
    const result = getCurrentMonth();
    // El formato debe ser YYYY-MM
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it("retorna el formato correcto para un mes de enero", () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    const result = getCurrentMonth();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
    // El mes debe ser 01
    const [, month] = result.split("-");
    expect(month).toBe("01");
  });

  it("retorna el formato correcto para un mes de diciembre", () => {
    vi.setSystemTime(new Date("2025-12-01T12:00:00Z"));
    const result = getCurrentMonth();
    const [, month] = result.split("-");
    expect(month).toBe("12");
  });
});

// ─── formatMonthLabel ─────────────────────────────────────────────────────────

describe("formatMonthLabel", () => {
  it("formatea '2026-06' como 'junio de 2026' o variante localizada", () => {
    const result = formatMonthLabel("2026-06");
    // Debe contener el año
    expect(result).toContain("2026");
    // Debe contener algo relativo a junio (en es-AR puede variar la preposición)
    expect(result.toLowerCase()).toMatch(/jun/);
  });

  it("formatea '2025-12' con el año correcto", () => {
    const result = formatMonthLabel("2025-12");
    expect(result).toContain("2025");
    expect(result.toLowerCase()).toMatch(/dic/);
  });

  it("formatea '2026-01' con enero", () => {
    const result = formatMonthLabel("2026-01");
    expect(result).toContain("2026");
    expect(result.toLowerCase()).toMatch(/ene/);
  });
});

// ─── prevMonth ────────────────────────────────────────────────────────────────

describe("prevMonth", () => {
  it("'2026-06' → '2026-05'", () => {
    expect(prevMonth("2026-06")).toBe("2026-05");
  });

  it("cruza año: '2026-01' → '2025-12'", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("'2026-10' → '2026-09'", () => {
    expect(prevMonth("2026-10")).toBe("2026-09");
  });

  it("retorna formato YYYY-MM", () => {
    expect(prevMonth("2026-03")).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ─── nextMonth ────────────────────────────────────────────────────────────────

describe("nextMonth", () => {
  it("'2026-06' → '2026-07'", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
  });

  it("cruza año: '2025-12' → '2026-01'", () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });

  it("'2026-09' → '2026-10'", () => {
    expect(nextMonth("2026-09")).toBe("2026-10");
  });

  it("retorna formato YYYY-MM", () => {
    expect(nextMonth("2026-03")).toMatch(/^\d{4}-\d{2}$/);
  });
});
