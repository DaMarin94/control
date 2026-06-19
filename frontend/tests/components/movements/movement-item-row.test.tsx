/**
 * Tests de MovementItemRow (RF-VM-001).
 * Verifica:
 * - Render básico: nombre, monto, categoría, tipo.
 * - Frecuencia dinámica en la sublínea de fijos (P2 — Fase 1.1.1).
 * - Render del ítem fijo anulado (skipped=true): badge, tachado, opacity (P1 — Fase 1.1.1).
 * - Acción "Anular este mes" en el KebabMenu de fijos activos (P1 — Fase 1.1.1).
 * - Acción "Des-anular este mes" en el KebabMenu de fijos anulados (P1 — Fase 1.1.1).
 * - Únicos y cuotas NO tienen la acción de anular en su KebabMenu.
 * - Fase 1.1.7: chip "Calculado" para hijos, indicador GitBranch para padres,
 *   monto negativo/cero, acción "Crear movimiento desde este".
 * - Fase 1.1.8: chip/marca padre en único y cuota; acción kebab en único/cuota no calculados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  })),
}));

import { useRecurring } from "@/hooks/use-recurring";

const mockUseRecurring = vi.mocked(useRecurring);

const mockSkipRecurring = vi.fn();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCategory = {
  id: "cat-1",
  name: "Servicios",
  color: "#FF5733",
  scope: "EXPENSE" as const,
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
  frequency: "MONTHLY",
  skipped: false,
  category: baseCategory,
  calculated: null,
  hasCalculated: false,
};

const fijoAnulado: MovementItem = {
  ...fijoActivo,
  skipped: true,
};

const fijoBimestral: MovementItem = {
  ...fijoActivo,
  frequency: "BIMONTHLY",
  description: "Seguro",
};

const fijoTrimestral: MovementItem = {
  ...fijoActivo,
  frequency: "QUARTERLY",
  description: "Cuota anual",
};

const fijoSemestral: MovementItem = {
  ...fijoActivo,
  frequency: "BIANNUAL",
  description: "Impuesto",
};

const fijoAnual: MovementItem = {
  ...fijoActivo,
  frequency: "ANNUAL",
  description: "Renovación",
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
  skipped: false,
  category: { id: "cat-2", name: "Alimentación", color: "#00FF00", scope: "BOTH" },
  calculated: null,
  hasCalculated: false,
};

const cuota: MovementItem = {
  id: "inst-1",
  origin: "cuota",
  type: "EXPENSE",
  amountCents: 50000,
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: { number: 3, total: 12, startMonth: "2026-01" },
  frequency: null,
  skipped: false,
  category: { id: "cat-3", name: "Tecnología", color: "#0000FF", scope: "EXPENSE" },
  calculated: null,
  hasCalculated: false,
};

/** Fijo calculado (hijo) */
const fijoCalculado: MovementItem = {
  ...fijoActivo,
  id: "calc-1",
  description: "Ahorro",
  amountCents: 15000,
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
  hasCalculated: false,
};

/** Fijo calculado con monto negativo */
const fijoCalculadoNegativo: MovementItem = {
  ...fijoCalculado,
  id: "calc-neg",
  amountCents: -5000,
  calculated: {
    ...fijoCalculado.calculated!,
    formulaSign: -1,
  },
};

/** Fijo calculado con monto cero */
const fijoCalculadoCero: MovementItem = {
  ...fijoCalculado,
  id: "calc-zero",
  amountCents: 0,
};

/** Fijo padre (tiene calculados derivados) */
const fijoPadre: MovementItem = {
  ...fijoActivo,
  id: "padre-1",
  description: "Sueldo",
  hasCalculated: true,
};

// ─── Fixtures Fase 1.1.8 — calculados de único y cuota ───────────────────────

/** Único calculado (hijo) — Fase 1.1.8 */
const unicoCalculado: MovementItem = {
  ...unico,
  id: "calc-unico-1",
  description: "Ahorro rápido",
  amountCents: 5000,
  calculated: {
    sourceType: "unico",
    sourceChainId: null, // null para origen único (Fase 1.1.8)
    sourceId: "trans-orig",
    sourceDescription: "Almuerzo",
    formulaOperator: "PCT",
    formulaOperand: 1000,
    formulaSign: 1,
    sourceAmountCents: 10000,
  },
  hasCalculated: false,
};

/** Único padre (tiene calculados derivados) — Fase 1.1.8 */
const unicoPadre: MovementItem = {
  ...unico,
  id: "unico-padre-1",
  description: "Almuerzo caro",
  hasCalculated: true,
};

/** Cuota calculada (hijo) — Fase 1.1.8 */
const cuotaCalculada: MovementItem = {
  ...cuota,
  id: "calc-cuota-1",
  description: "Ahorro cuota",
  amountCents: 8000,
  // Un calculado tiene installment === null (no integra el plan de cuotas)
  installment: null,
  calculated: {
    sourceType: "cuota",
    sourceChainId: null, // null para origen cuota (Fase 1.1.8)
    sourceId: "inst-group-orig",
    sourceDescription: "Notebook",
    formulaOperator: "PCT",
    formulaOperand: 1000,
    formulaSign: 1,
    sourceAmountCents: 50000,
  },
  hasCalculated: false,
};

/** Cuota padre (tiene calculados derivados) — Fase 1.1.8 */
const cuotaPadre: MovementItem = {
  ...cuota,
  id: "cuota-padre-1",
  description: "Notebook premium",
  hasCalculated: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function renderRow(movement: MovementItem, viewMonth = "2026-06") {
  return render(
    <MovementItemRow
      movement={movement}
      viewMonth={viewMonth}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
    { wrapper: createWrapper() },
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRecurring.mockReturnValue({
    createRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    skipRecurring: mockSkipRecurring,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });
});

// ─── Tests: render básico ─────────────────────────────────────────────────────

describe("MovementItemRow — render básico", () => {
  it("muestra la descripción del movimiento", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("muestra el monto formateado con signo (gasto con −$)", () => {
    renderRow(fijoActivo);
    // 150000 centavos = $1.500,00
    expect(screen.getByText("−$1.500,00")).toBeInTheDocument();
  });

  it("muestra la categoría en la sublínea", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("Servicios")).toBeInTheDocument();
  });
});

// ─── Tests: frecuencia dinámica en sublínea (P2 — Fase 1.1.1) ────────────────

describe("MovementItemRow — frecuencia dinámica en la sublínea (P2)", () => {
  it("muestra 'mensual' para MONTHLY", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("mensual")).toBeInTheDocument();
  });

  it("muestra 'bimestral' para BIMONTHLY", () => {
    renderRow(fijoBimestral);
    expect(screen.getByText("bimestral")).toBeInTheDocument();
  });

  it("muestra 'trimestral' para QUARTERLY", () => {
    renderRow(fijoTrimestral);
    expect(screen.getByText("trimestral")).toBeInTheDocument();
  });

  it("muestra 'semestral' para BIANNUAL", () => {
    renderRow(fijoSemestral);
    expect(screen.getByText("semestral")).toBeInTheDocument();
  });

  it("muestra 'anual' para ANNUAL", () => {
    renderRow(fijoAnual);
    expect(screen.getByText("anual")).toBeInTheDocument();
  });

  it("no muestra segmento de frecuencia para movimientos únicos", () => {
    renderRow(unico);
    expect(screen.queryByText(/mensual|bimestral|trimestral|semestral|anual/i)).not.toBeInTheDocument();
  });
});

// ─── Tests: ítem fijo anulado (P1 — Fase 1.1.1) ──────────────────────────────

describe("MovementItemRow — ítem fijo anulado (P1)", () => {
  it("muestra el badge 'Anulado' cuando skipped=true", () => {
    renderRow(fijoAnulado);
    expect(screen.getByText("Anulado")).toBeInTheDocument();
  });

  it("NO muestra el badge 'Anulado' cuando skipped=false", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText("Anulado")).not.toBeInTheDocument();
  });

  it("el monto sigue mostrándose con el mismo valor aunque esté anulado", () => {
    renderRow(fijoAnulado);
    expect(screen.getByText("−$1.500,00")).toBeInTheDocument();
  });

  it("el KebabMenu sigue siendo accesible cuando el ítem está anulado", () => {
    renderRow(fijoAnulado);
    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    expect(trigger).toBeInTheDocument();
  });
});

// ─── Tests: acción Anular / Des-anular en KebabMenu (P1 — Fase 1.1.1) ────────

describe("MovementItemRow — acción Anular/Des-anular en KebabMenu (P1)", () => {
  it("fijo activo: muestra 'Anular este mes' en el KebabMenu", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /anular este mes/i })).toBeInTheDocument();
  });

  it("fijo anulado: muestra 'Des-anular este mes' en el KebabMenu", () => {
    renderRow(fijoAnulado);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /des-anular este mes/i })).toBeInTheDocument();
  });

  it("fijo activo: NO muestra 'Des-anular este mes' en el KebabMenu", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("click en 'Anular este mes' llama a skipRecurring con el id y viewMonth", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: true });

    renderRow(fijoActivo, "2026-06");

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const anularItem = screen.getByRole("menuitem", { name: /anular este mes/i });
    fireEvent.click(anularItem);

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", "2026-06");
    });
  });

  it("click en 'Des-anular este mes' llama a skipRecurring con el id y viewMonth", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: false });

    renderRow(fijoAnulado, "2026-07");

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const desAnularItem = screen.getByRole("menuitem", { name: /des-anular este mes/i });
    fireEvent.click(desAnularItem);

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", "2026-07");
    });
  });

  it("único NO tiene la acción 'Anular este mes'", () => {
    renderRow(unico);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /anular este mes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("cuota NO tiene la acción 'Anular este mes'", () => {
    renderRow(cuota);

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /anular este mes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("el KebabMenu del fijo tiene: Editar, Anular este mes, Eliminar (en ese orden)", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/editar/i);
    expect(items[1]).toHaveTextContent(/anular este mes/i);
    expect(items[2]).toHaveTextContent(/eliminar/i);
  });
});

// ─── Tests: el skip solo es peligroso para Eliminar ──────────────────────────

describe("MovementItemRow — semántica del KebabMenu", () => {
  it("'Anular este mes' es acción neutra (no danger), 'Eliminar' sí es danger", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    // El ítem "Eliminar" debe tener la clase de danger — lo verificamos buscando el texto
    const items = screen.getAllByRole("menuitem");
    const eliminarItem = items.find((i) => /eliminar/i.test(i.textContent ?? ""));
    const anularItem = items.find((i) => /anular este mes/i.test(i.textContent ?? ""));

    expect(eliminarItem).toBeInTheDocument();
    expect(anularItem).toBeInTheDocument();
  });
});

// ─── Tests: Fase 1.1.7 — calculados / padre/hijo / monto negativo ────────────

describe("MovementItemRow — Fase 1.1.7: indicadores calculado/padre", () => {
  it("ítem calculado muestra el chip 'Calculado' en la sublínea", () => {
    renderRow(fijoCalculado);
    expect(screen.getByText("Calculado")).toBeInTheDocument();
  });

  it("ítem calculado muestra 'desde Sueldo' en la sublínea", () => {
    renderRow(fijoCalculado);
    expect(screen.getByText("Sueldo")).toBeInTheDocument();
    expect(screen.getByText("desde")).toBeInTheDocument();
  });

  it("ítem no calculado NO muestra el chip 'Calculado'", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("ítem padre con hasCalculated=true no muestra chip 'Calculado'", () => {
    renderRow(fijoPadre);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("ítem calculado NO tiene la acción 'Crear movimiento desde este' en el KebabMenu", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={fijoCalculado}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de ahorro/i });
    fireEvent.click(trigger);

    expect(
      screen.queryByRole("menuitem", { name: /crear movimiento desde este/i }),
    ).not.toBeInTheDocument();
  });

  it("ítem fijo NO calculado con onCreateCalculated tiene la acción en el KebabMenu", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={fijoActivo}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /crear movimiento desde este/i }),
    ).toBeInTheDocument();
  });

  it("click en 'Crear movimiento desde este' llama al handler con el movement", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={fijoActivo}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const crearItem = screen.getByRole("menuitem", { name: /crear movimiento desde este/i });
    fireEvent.click(crearItem);

    expect(onCreateCalculated).toHaveBeenCalledWith(fijoActivo);
  });
});

describe("MovementItemRow — Fase 1.1.7: monto negativo/cero", () => {
  it("monto negativo en calculado muestra prefijo −", () => {
    renderRow(fijoCalculadoNegativo);
    // amountCents = -5000 → "−$50,00"
    expect(screen.getByText("−$50,00")).toBeInTheDocument();
  });

  it("monto cero en calculado muestra '$0,00' sin prefijo", () => {
    renderRow(fijoCalculadoCero);
    expect(screen.getByText("$0,00")).toBeInTheDocument();
  });

  it("monto de gasto calculado positivo no muestra prefijo + ni −$", () => {
    renderRow(fijoCalculado);
    // amountCents = 15000 → "$150,00" (sin prefijo +/−)
    expect(screen.getByText("$150,00")).toBeInTheDocument();
  });
});

// ─── Tests: Fase 1.1.8 — calculados de único y cuota ─────────────────────────

describe("MovementItemRow — Fase 1.1.8: calculado de único", () => {
  it("único calculado muestra el chip 'Calculado'", () => {
    renderRow(unicoCalculado);
    expect(screen.getByText("Calculado")).toBeInTheDocument();
  });

  it("único calculado muestra 'desde Almuerzo' en la sublínea", () => {
    renderRow(unicoCalculado);
    expect(screen.getByText("Almuerzo")).toBeInTheDocument();
    expect(screen.getByText("desde")).toBeInTheDocument();
  });

  it("único calculado NO muestra 'mensual' (sin segmento de frecuencia)", () => {
    renderRow(unicoCalculado);
    expect(screen.queryByText(/mensual|bimestral|trimestral|semestral|anual/i)).not.toBeInTheDocument();
  });

  it("único calculado NO tiene la acción 'Crear movimiento desde este'", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={unicoCalculado}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de ahorro rápido/i });
    fireEvent.click(trigger);

    expect(
      screen.queryByRole("menuitem", { name: /crear movimiento desde este/i }),
    ).not.toBeInTheDocument();
  });

  it("único NO calculado tiene 'Crear movimiento desde este' en el KebabMenu", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={unico}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /crear movimiento desde este/i }),
    ).toBeInTheDocument();
  });
});

describe("MovementItemRow — Fase 1.1.8: calculado de cuota", () => {
  it("cuota calculada muestra el chip 'Calculado'", () => {
    renderRow(cuotaCalculada);
    expect(screen.getByText("Calculado")).toBeInTheDocument();
  });

  it("cuota calculada muestra 'desde Notebook' en la sublínea", () => {
    renderRow(cuotaCalculada);
    expect(screen.getByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("desde")).toBeInTheDocument();
  });

  it("cuota calculada NO muestra etiqueta 'Cuota X/N' (columna 3 vacía, installment=null)", () => {
    renderRow(cuotaCalculada);
    expect(screen.queryByText(/cuota \d+\/\d+/i)).not.toBeInTheDocument();
  });

  it("cuota NO calculada tiene 'Crear movimiento desde este' en el KebabMenu", () => {
    const onCreateCalculated = vi.fn();
    render(
      <MovementItemRow
        movement={cuota}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /crear movimiento desde este/i }),
    ).toBeInTheDocument();
  });
});

describe("MovementItemRow — Fase 1.1.8: marca padre en único y cuota", () => {
  it("único padre (hasCalculated=true) NO muestra chip 'Calculado'", () => {
    renderRow(unicoPadre);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("cuota padre (hasCalculated=true) NO muestra chip 'Calculado'", () => {
    renderRow(cuotaPadre);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });
});
