/**
 * Tests de SimulatedMovementRow (docs/design.md "Simulación de categoría
 * (`/mes`)" §1, RF-SIM-003).
 * Verifica:
 * - Nombre de la fila = nombre de la categoría (el simulado no tiene descripción propia).
 * - Sublínea: chip "Simulado" + punto de categoría + nombre + "· tendencia de 12 meses".
 * - Col 1: caja hueca con borde punteado (dashed) del color del tipo, con la
 *   flecha de dirección correcta (gasto ↓ / ingreso ↑).
 * - Col 3 vacía (sin fecha, sin "Cuota X/N").
 * - Col 4: monto con prefijo "≈", signo y color por tipo.
 * - Sin kebab (⋮) — el placeholder de la col 5 es inerte (aria-hidden, sin botón).
 * - No interactiva: sin role="button", sin tabIndex, sin cursor de mano.
 * - No atenuada (nunca opacity-[0.55], a diferencia de un ítem anulado).
 * - Marca de límite: efecto "fill" aplica fondo; "glyph" muestra LimitGlyph;
 *   "badge" muestra LimitBadge en la identidad (mismo slot que "Anulado" en una fila real).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimulatedMovementRow } from "@/components/movements/simulated-movement-row";
import type { MovementItem } from "@/types/movement";
import type { EvaluatedLimitMark } from "@/lib/limits/evaluate";
import type { LimitConfig, LimitEffect } from "@/types/limit";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseSimulated: MovementItem = {
  id: "simulated:sim-1:2026-08",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 12500,
  description: null,
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  skipped: false,
  category: { id: "cat-1", name: "Suscripciones", color: "#3B7DE0", scope: "BOTH" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 12500,
  simulated: true,
  calculatedChildren: [],
};

function makeLimitMark(effect: LimitEffect): EvaluatedLimitMark {
  const limit: LimitConfig = {
    id: "limit-1",
    label: "Gasto por movimiento",
    enabled: true,
    anchorKey: "mes.item.monto",
    operator: "gt",
    threshold: 100,
    nature: "passive",
    effect,
  };
  return { effect, matched: [limit] };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SimulatedMovementRow", () => {
  it("usa el nombre de la categoría como nombre de la fila", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    // Aparece dos veces: nombre de la fila (col 2, título) y de nuevo en la
    // sublínea (punto de color + nombre) — mismo patrón que cualquier fila.
    expect(screen.getAllByText("Suscripciones").length).toBe(2);
  });

  it("muestra el chip 'Simulado' y el segmento '· tendencia de 12 meses'", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.getByText("Simulado")).toBeInTheDocument();
    expect(screen.getByText("tendencia de 12 meses")).toBeInTheDocument();
  });

  it("gasto: ícono de dirección ↓ dentro de una caja con borde punteado color expense", () => {
    const { container } = render(<SimulatedMovementRow movement={baseSimulated} />);
    const iconBox = container.querySelector(".border-dashed");
    expect(iconBox).toBeInTheDocument();
    expect(iconBox).toHaveClass("border-expense");
  });

  it("ingreso: ícono de dirección ↑ dentro de una caja con borde punteado color income", () => {
    const income: MovementItem = { ...baseSimulated, type: "INCOME" };
    const { container } = render(<SimulatedMovementRow movement={income} />);
    const iconBox = container.querySelector(".border-dashed");
    expect(iconBox).toHaveClass("border-income");
  });

  it("col 3 está vacía (sin fecha, sin 'Cuota X/N')", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.queryByText(/cuota/i)).not.toBeInTheDocument();
  });

  it("monto con prefijo '≈', signo '−' y color de gasto", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.getByText("≈")).toBeInTheDocument();
    // 12500 centavos = $125,00
    expect(screen.getByText(/−\$125,00/)).toBeInTheDocument();
  });

  it("monto de ingreso con signo '+'", () => {
    const income: MovementItem = { ...baseSimulated, type: "INCOME" };
    render(<SimulatedMovementRow movement={income} />);
    expect(screen.getByText(/\+\$125,00/)).toBeInTheDocument();
  });

  it("no muestra kebab (⋮) — sin botón de acciones", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no es interactiva: sin role='button' y sin tabIndex en la fila", () => {
    const { container } = render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const row = container.firstChild as HTMLElement;
    expect(row).not.toHaveAttribute("tabindex");
    expect(row.className).toContain("cursor-default");
    expect(row.className).not.toContain("cursor-pointer");
  });

  it("no se atenúa (nunca opacity-[0.55], a diferencia de un ítem anulado)", () => {
    const { container } = render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(container.innerHTML).not.toContain("opacity-[0.55]");
  });

  it("sin marca de límite: no aparece ningún glifo/badge de límite", () => {
    render(<SimulatedMovementRow movement={baseSimulated} />);
    expect(screen.queryByText(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("marca de límite efecto 'glyph': aparece en la zona de estados con su tooltip accesible", () => {
    render(<SimulatedMovementRow movement={baseSimulated} limitMark={makeLimitMark("glyph")} />);
    expect(screen.getByLabelText(/supera el límite: gasto por movimiento/i)).toBeInTheDocument();
  });

  it("marca de límite efecto 'badge': aparece en la identidad, mismo slot que ocuparía 'Anulado'", () => {
    render(<SimulatedMovementRow movement={baseSimulated} limitMark={makeLimitMark("badge")} />);
    expect(screen.getByText("Límite")).toBeInTheDocument();
  });

  it("marca de límite efecto 'fill': SÍ se aplica (única excepción a 'sin hover/tinte')", () => {
    const { container } = render(<SimulatedMovementRow movement={baseSimulated} limitMark={makeLimitMark("fill")} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toMatch(/bg-warning/);
  });
});
