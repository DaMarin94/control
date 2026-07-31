/**
 * Tests de MovementDetailCard (docs/design.md §"Card de detalle de movimiento").
 *
 * Cobertura:
 * - Cierre: ✕, Esc, clic en el scrim (excepción a la regla de modales — la
 *   card es read-only/auxiliar); clic DENTRO del panel no cierra.
 * - Hero: ícono tintado + cifra convertida + badge de moneda (cross-rate) +
 *   line-through cuando skipped + badge "Anulado".
 * - Ficha: Categoría, Método (+chip tipo, día de cierre/cobro si crédito),
 *   Débito automático (solo si true), Monto original + Cotización (cross-rate).
 * - Por tipo: único (Fecha + hora), fijo (Frecuencia + Vigencia), cuota (Plan
 *   de cuotas), calculado (Origen + Fórmula con resultado y badge de tipo derivado).
 * - Sin footer ni botón "Editar" — card read-only pura (editar vive en el kebab).
 */

import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MovementDetailCard } from "@/components/movements/movement-detail-card";
import type { MovementItem } from "@/types/movement";

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    settings: { defaultCurrency: "ARS", lastExchangeRate: null },
    defaultCurrency: "ARS",
    lastExchangeRate: null,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  })),
}));

import { useSettings } from "@/hooks/use-settings";
const mockUseSettings = vi.mocked(useSettings);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCategory = {
  id: "cat-1",
  name: "Servicios",
  color: "#FF5733",
  scope: "EXPENSE" as const,
};

const unico: MovementItem = {
  id: "mov-1",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 10000,
  description: "Almuerzo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  skipped: false,
  category: { id: "cat-2", name: "Alimentación", color: "#00FF00", scope: "BOTH" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 10000,
  calculatedChildren: [],
};

const fijoActivo: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2024-03",
  endMonth: null,
  skipped: false,
  category: baseCategory,
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 150000,
  calculatedChildren: [],
};

const cuota: MovementItem = {
  id: "inst-1",
  origin: "cuota",
  type: "EXPENSE",
  amountCents: 50000,
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: { number: 3, total: 12, startMonth: "2024-03" },
  frequency: null,
  startMonth: null,
  endMonth: null,
  skipped: false,
  category: { id: "cat-3", name: "Tecnología", color: "#0000FF", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 50000,
  calculatedChildren: [],
};

const fijoCalculado: MovementItem = {
  ...fijoActivo,
  id: "calc-1",
  description: "Ahorro",
  amountCents: 15000,
  convertedAmountCents: 15000,
  calculated: {
    sourceType: "fijo",
    sourceChainId: "chain-orig",
    sourceId: "rec-1",
    sourceDescription: "Sueldo",
    formulaOperator: "PCT",
    formulaOperand: 1000, // 10% (10 × 100)
    formulaSign: 1,
    sourceAmountCents: 150000,
  },
};

/** Fijo con derivados (calculados en el origen) — Fase 1.1.9 */
const fijoConDerivados: MovementItem = {
  ...fijoActivo,
  id: "rec-origen-1",
  hasCalculated: true,
  calculatedChildren: [
    {
      id: "calc-child-1",
      description: "Ahorro 10%",
      type: "EXPENSE",
      convertedAmountCents: 15000,
      formulaOperator: "PCT",
      formulaOperand: 1000,
      formulaSign: -1,
    },
    {
      id: "calc-child-2",
      description: "Bono 5%",
      type: "INCOME",
      convertedAmountCents: 7500,
      formulaOperator: "PCT",
      formulaOperand: 500,
      formulaSign: 1,
    },
  ],
};

function renderCard(movement: MovementItem, onClose = vi.fn()) {
  return render(<MovementDetailCard movement={movement} onClose={onClose} />);
}

// ─── Tests: cierre ────────────────────────────────────────────────────────────

describe("MovementDetailCard — cierre (excepción: también por clic en el scrim)", () => {
  it("cierra con el botón ✕", () => {
    const onClose = vi.fn();
    renderCard(unico, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("cierra con Esc", () => {
    const onClose = vi.fn();
    renderCard(unico, onClose);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("cierra con clic en el scrim", () => {
    const onClose = vi.fn();
    const { container } = renderCard(unico, onClose);
    const scrim = container.parentElement?.querySelector('[role="dialog"]');
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("NO cierra al clickear dentro del panel", () => {
    const onClose = vi.fn();
    renderCard(unico, onClose);
    fireEvent.click(screen.getByText("Categoría"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cierra con clic en el scrim incluso montada dentro de una fila con su propio onClick (regresión: el evento sintético de React burbujea por el árbol de React —no el de DOM— pese al portal a document.body, y podía reabrir la card)", () => {
    function RowLike() {
      const [open, setOpen] = useState(true);
      return (
        <div onClick={() => setOpen(true)} data-testid="row">
          {open && <MovementDetailCard movement={unico} onClose={() => setOpen(false)} />}
        </div>
      );
    }
    render(<RowLike />);

    const scrim = document.body.querySelector('[role="dialog"]');
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim as Element);
    expect(screen.queryByText("Categoría")).not.toBeInTheDocument();
  });
});

// ─── Tests: hero ──────────────────────────────────────────────────────────────

describe("MovementDetailCard — hero", () => {
  it("muestra la cifra convertida dominante con signo", () => {
    renderCard(fijoActivo);
    expect(screen.getByText("−$1.500,00")).toBeInTheDocument();
  });

  it("badge 'Anulado' + line-through cuando skipped", () => {
    renderCard({ ...unico, skipped: true });
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    expect(screen.getByText("−$100,00")).toHaveClass("line-through");
  });

  it("sin badge 'Anulado' cuando no está anulado", () => {
    renderCard(unico);
    expect(screen.queryByText("Anulado")).not.toBeInTheDocument();
  });

  it("cross-rate: muestra el badge de código de moneda junto a la cifra", () => {
    const unicoUSD: MovementItem = {
      ...unico,
      currency: "USD",
      exchangeRate: 120000,
      amountCents: 1500,
      convertedAmountCents: 180000,
    };
    renderCard(unicoUSD);
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("mono-moneda: NO muestra badge de código", () => {
    renderCard(unico);
    expect(screen.queryByText("USD")).not.toBeInTheDocument();
    expect(screen.queryByText("ARS")).not.toBeInTheDocument();
  });
});

// ─── Tests: ficha — Categoría / Método / Débito automático ──────────────────

describe("MovementDetailCard — ficha: Categoría / Método / Débito automático", () => {
  it("muestra la fila Categoría", () => {
    renderCard(unico);
    expect(screen.getByText("Categoría")).toBeInTheDocument();
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
  });

  it("sin método de pago: la fila Método se omite", () => {
    renderCard(unico);
    expect(screen.queryByText("Método")).not.toBeInTheDocument();
  });

  it("con método de pago: muestra nombre + chip de tipo", () => {
    const conMetodo: MovementItem = {
      ...unico,
      paymentMethod: { id: "pm-1", name: "Débito Banco Nación", icon: "card", type: "DEBIT", closingDay: null, paymentDay: null },
    };
    renderCard(conMetodo);
    expect(screen.getByText("Método")).toBeInTheDocument();
    expect(screen.getByText("Débito Banco Nación")).toBeInTheDocument();
    expect(screen.getByText("Débito")).toBeInTheDocument();
  });

  it("método CREDIT con día de cierre/cobro: muestra ambos", () => {
    const conCredito: MovementItem = {
      ...unico,
      paymentMethod: { id: "pm-2", name: "Visa", icon: "visa", type: "CREDIT", closingDay: 15, paymentDay: 10 },
    };
    renderCard(conCredito);
    expect(screen.getByText("Crédito")).toBeInTheDocument();
    expect(screen.getByText(/Cierre día 15/)).toBeInTheDocument();
    expect(screen.getByText(/Cobro día 10/)).toBeInTheDocument();
  });

  it("débito automático: fila 'Débito automático' con 'Sí' solo si autoDebit === true", () => {
    renderCard({ ...unico, autoDebit: true });
    expect(screen.getByText("Débito automático")).toBeInTheDocument();
    expect(screen.getByText("Sí")).toBeInTheDocument();
  });

  it("sin débito automático (false/null): fila se omite", () => {
    renderCard({ ...unico, autoDebit: false });
    expect(screen.queryByText("Débito automático")).not.toBeInTheDocument();
    renderCard({ ...unico, autoDebit: null });
    expect(screen.queryAllByText("Débito automático")).toHaveLength(0);
  });
});

// ─── Tests: cross-rate — Monto original + Cotización ─────────────────────────

describe("MovementDetailCard — cross-rate: Monto original + Cotización", () => {
  it("muestra 'Monto original' y 'Cotización' cuando currency ≠ default", () => {
    mockUseSettings.mockReturnValue({
      settings: { defaultCurrency: "ARS", lastExchangeRate: null },
      defaultCurrency: "ARS",
      lastExchangeRate: null,
      isLoading: false,
      isError: false,
      updateSettings: vi.fn(),
      isSaving: false,
    });
    const unicoUSD: MovementItem = {
      ...unico,
      currency: "USD",
      exchangeRate: 1200,
      amountCents: 2000, // USD 20,00
      convertedAmountCents: 2400000,
    };
    renderCard(unicoUSD);
    expect(screen.getByText("Monto original")).toBeInTheDocument();
    expect(screen.getByText("US$20,00")).toBeInTheDocument();
    expect(screen.getByText("Cotización")).toBeInTheDocument();
    expect(screen.getByText("1 USD = $1.200,00")).toBeInTheDocument();
  });

  it("mono-moneda: NO muestra 'Monto original' ni 'Cotización'", () => {
    renderCard(unico);
    expect(screen.queryByText("Monto original")).not.toBeInTheDocument();
    expect(screen.queryByText("Cotización")).not.toBeInTheDocument();
  });
});

// ─── Tests: por tipo — único (Fecha + hora) ──────────────────────────────────

describe("MovementDetailCard — único: Fecha con hora", () => {
  it("muestra fecha + hora (a diferencia de la fila, que no muestra hora)", () => {
    renderCard(unico);
    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.getByText("17/06/2026 · 14:30")).toBeInTheDocument();
  });
});

// ─── Tests: por tipo — fijo (Frecuencia + Vigencia) ──────────────────────────

describe("MovementDetailCard — fijo: Frecuencia + Vigencia", () => {
  it("Frecuencia capitalizada", () => {
    renderCard(fijoActivo);
    expect(screen.getByText("Frecuencia")).toBeInTheDocument();
    expect(screen.getByText("Mensual")).toBeInTheDocument();
  });

  it("Vigencia: 'Desde Mar 2024 · activo' cuando endMonth es null", () => {
    renderCard(fijoActivo);
    expect(screen.getByText("Vigencia")).toBeInTheDocument();
    expect(screen.getByText(/Desde Mar 2024/)).toBeInTheDocument();
    expect(screen.getByText(/activo/)).toBeInTheDocument();
  });

  it("Vigencia: rango 'Mar 2024 – Jun 2026' cuando endMonth = '2026-07' (exclusivo)", () => {
    renderCard({ ...fijoActivo, endMonth: "2026-07" });
    expect(screen.getByText("Mar 2024 – Jun 2026")).toBeInTheDocument();
  });

  it("Vigencia: colapsa a un solo mes cuando arranque == último mes activo", () => {
    renderCard({ ...fijoActivo, startMonth: "2024-03", endMonth: "2024-04" });
    expect(screen.getByText("Mar 2024")).toBeInTheDocument();
  });
});

// ─── Tests: por tipo — cuota (Plan de cuotas) ────────────────────────────────

describe("MovementDetailCard — cuota: Plan de cuotas", () => {
  it("muestra 'Cuota 3 de 12 · desde Mar 2024'", () => {
    renderCard(cuota);
    expect(screen.getByText("Plan de cuotas")).toBeInTheDocument();
    expect(screen.getByText("Cuota 3 de 12")).toBeInTheDocument();
    expect(screen.getByText(/desde Mar 2024/)).toBeInTheDocument();
  });
});

// ─── Tests: cuota — Total del plan (docs/design.md §"Total del plan de cuotas") ──

describe("MovementDetailCard — cuota: Total del plan", () => {
  it("muestra 'Total del plan' = monto por cuota × cantidad, sin signo", () => {
    renderCard(cuota); // amountCents=50000, total=12 → 600000 → "$6.000,00"
    expect(screen.getByText("Total del plan")).toBeInTheDocument();
    expect(screen.getByText("$6.000,00")).toBeInTheDocument();
  });

  it("cross-rate: el total sale en la MONEDA ORIGINAL (no el convertido × cantidad) con chip neutro del código", () => {
    const cuotaUSD: MovementItem = {
      ...cuota,
      currency: "USD",
      exchangeRate: 1200,
      amountCents: 2000, // US$20,00 por cuota
      convertedAmountCents: 2400000, // $24.000,00 convertido (NO debe multiplicarse por 12)
    };
    renderCard(cuotaUSD);
    // Total correcto: 2000 * 12 = 24000 centavos → "US$240,00"
    expect(screen.getByText("US$240,00")).toBeInTheDocument();
    // Prohibido: el convertido (24000,00) multiplicado por 12 sería "$288.000,00"
    expect(screen.queryByText("$288.000,00")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Total del plan en USD")).toBeInTheDocument();
  });

  it("'total === 1': la fila 'Total del plan' NO aparece", () => {
    renderCard({ ...cuota, installment: { number: 1, total: 1, startMonth: "2024-03" } });
    expect(screen.queryByText("Total del plan")).not.toBeInTheDocument();
  });

  it("anulado: el total NO lleva line-through (solo el hero lo tiene)", () => {
    renderCard({ ...cuota, skipped: true });
    const total = screen.getByText("$6.000,00");
    expect(total).not.toHaveClass("line-through");
  });
});

// ─── Tests: calculado — Origen + Fórmula ─────────────────────────────────────

describe("MovementDetailCard — calculado: bloque Origen + Fórmula", () => {
  it("muestra la caja Origen con el nombre del origen", () => {
    renderCard(fijoCalculado);
    expect(screen.getByText("Origen")).toBeInTheDocument();
    expect(screen.getByText("Sueldo")).toBeInTheDocument();
  });

  it("muestra la Fórmula con expresión legible, resultado y badge de tipo derivado", () => {
    renderCard(fijoCalculado);
    expect(screen.getByText("Fórmula")).toBeInTheDocument();
    // 10% de $1.500,00 (sourceAmountCents=150000 → $1.500,00)
    expect(screen.getByText("10% de $1.500,00")).toBeInTheDocument();
    // Resultado: amountCents=15000 → $150,00 (positivo, sin prefijo) — aparece
    // dos veces: hero (cifra dominante) y bloque Fórmula (mismo valor, coincide).
    expect(screen.getAllByText("$150,00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Gasto")).toBeInTheDocument();
  });

  it("no calculado: NO muestra el bloque Origen/Fórmula", () => {
    renderCard(unico);
    expect(screen.queryByText("Origen")).not.toBeInTheDocument();
    expect(screen.queryByText("Fórmula")).not.toBeInTheDocument();
  });
});

// ─── Tests: "Calculados" — derivados del origen (Fase 1.1.9) ────────────────

describe('MovementDetailCard — bloque "Calculados" (derivados del origen)', () => {
  it("con ≥1 derivado: muestra el rótulo y una caja por derivado con nombre + monto + color por tipo", () => {
    renderCard(fijoConDerivados);
    expect(screen.getByText("Calculados")).toBeInTheDocument();

    expect(screen.getByText("Ahorro 10%")).toBeInTheDocument();
    const gastoAmount = screen.getByText("−$150,00");
    expect(gastoAmount).toBeInTheDocument();
    expect(gastoAmount).toHaveClass("text-ink");

    expect(screen.getByText("Bono 5%")).toBeInTheDocument();
    const ingresoAmount = screen.getByText("$75,00");
    expect(ingresoAmount).toBeInTheDocument();
    expect(ingresoAmount).toHaveClass("text-income-ink");
  });

  it("con lista vacía: NO muestra el bloque", () => {
    renderCard(fijoActivo);
    expect(screen.queryByText("Calculados")).not.toBeInTheDocument();
  });

  it("no clickeable: sin role=button ni onClick en la caja del derivado", () => {
    renderCard(fijoConDerivados);
    const box = screen.getByText("Ahorro 10%").closest("div");
    expect(box).not.toHaveAttribute("role", "button");
    expect(box).not.toHaveClass("cursor-pointer");
  });

  it("en un ítem que ES calculado: NO muestra el bloque (un calculado nunca es padre)", () => {
    renderCard(fijoCalculado);
    expect(screen.queryByText("Calculados")).not.toBeInTheDocument();
  });
});
