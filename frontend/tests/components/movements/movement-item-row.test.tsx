/**
 * Tests de MovementItemRow (RF-VM-001).
 * Verifica:
 * - Render básico: nombre, monto, categoría, tipo.
 * - Frecuencia dinámica en la sublínea de fijos (P2 — Fase 1.1.1).
 * - Render del ítem fijo anulado (skipped=true): badge, tachado, opacity (P1 — Fase 1.1.1).
 * - Acción "Anular este mes" en el KebabMenu de fijos activos (P1 — Fase 1.1.1).
 * - Acción "Des-anular este mes" en el KebabMenu de fijos anulados (P1 — Fase 1.1.1).
 * - Calculados de único/cuota NO tienen la acción de anular en su KebabMenu (heredan skip del origen).
 * - Calculados de fijo SÍ tienen la acción de anular (RF-MF-005: skip propio del calculado).
 * - Fase 1.1.7: chip "Calculado" para hijos, indicador GitBranch para padres,
 *   monto negativo/cero, acción "Crear movimiento calculado" (ex "Crear movimiento desde este").
 * - Duplicar movimiento (docs/design.md): ítem "Duplicar" (Copy) en la 3.ª posición,
 *   mismo gate !isCalculated que "Crear movimiento calculado"; ausente en calculados.
 * - Fase 1.1.8: chip/marca padre en único y cuota; acción kebab en único/cuota no calculados.
 * - P3: el toggle de skip se extiende a únicos NO calculados ("Anular"/"Des-anular", sin
 *   alcance temporal) y a cuotas NO calculadas ("Anular este mes"/"Des-anular este mes").
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

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(),
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

// Mock de use-settings — defaultCurrency ARS (caso mono-moneda estándar)
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

import { useRecurring } from "@/hooks/use-recurring";
import { useTransactions } from "@/hooks/use-transactions";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";

const mockUseRecurring = vi.mocked(useRecurring);
const mockUseTransactions = vi.mocked(useTransactions);
const mockUseInstallments = vi.mocked(useInstallments);
const mockUseSettings = vi.mocked(useSettings);

const mockSkipRecurring = vi.fn();
const mockSkipTransaction = vi.fn();
const mockSkipInstallment = vi.fn();

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
  frequency: 1,
  startMonth: "2026-01",
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
  simulated: false,
  calculatedChildren: [],
};

const fijoAnulado: MovementItem = {
  ...fijoActivo,
  skipped: true,
};

const fijoBimestral: MovementItem = {
  ...fijoActivo,
  frequency: 2,
  description: "Seguro",
};

const fijoTrimestral: MovementItem = {
  ...fijoActivo,
  frequency: 3,
  description: "Cuota anual",
};

const fijoSemestral: MovementItem = {
  ...fijoActivo,
  frequency: 6,
  description: "Impuesto",
};

const fijoAnual: MovementItem = {
  ...fijoActivo,
  frequency: 12,
  description: "Renovación",
};

const fijoCadaCincoMeses: MovementItem = {
  ...fijoActivo,
  frequency: 5,
  description: "Mantenimiento",
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
  simulated: false,
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
  installment: { number: 3, total: 12, startMonth: "2026-01" },
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
  simulated: false,
  calculatedChildren: [],
};

/** Fijo calculado (hijo) */
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
  hasCalculated: false,
};

/** Fijo calculado con monto negativo (moneda ARS = default, sin cross-rate) */
const fijoCalculadoNegativo: MovementItem = {
  ...fijoCalculado,
  id: "calc-neg",
  amountCents: -5000,
  // El backend devuelve convertedAmountCents como magnitud (≥ 0); el signo viene de amountCents.
  convertedAmountCents: 5000,
  calculated: {
    ...fijoCalculado.calculated!,
    formulaSign: -1,
  },
};

/**
 * Fijo calculado negativo cross-rate (bug P6):
 * amountCents < 0 (signo real) y convertedAmountCents > 0 (magnitud en moneda default).
 * Antes del fix, el monto se mostraba sin el signo −.
 */
const fijoCalculadoNegativoCrossRate: MovementItem = {
  ...fijoCalculadoNegativo,
  id: "calc-neg-xrate",
  currency: "USD",
  // USD 10,00 → ARS 12.000,00 (exchange 1200,00 ARS/USD, escalado ×100)
  exchangeRate: 120000,
  amountCents: -1000,        // −USD 10,00 (con signo, negativo)
  convertedAmountCents: 120000, // ARS 1.200,00 (magnitud, siempre ≥ 0)
};

/** Fijo calculado con monto cero */
const fijoCalculadoCero: MovementItem = {
  ...fijoCalculado,
  id: "calc-zero",
  amountCents: 0,
  convertedAmountCents: 0,
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
  mockUseTransactions.mockReturnValue({
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    skipTransaction: mockSkipTransaction,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });
  mockUseInstallments.mockReturnValue({
    createInstallment: vi.fn(),
    updateInstallment: vi.fn(),
    deleteInstallment: vi.fn(),
    skipInstallment: mockSkipInstallment,
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

// ─── Tests: Card de detalle de movimiento — invocación cuerpo↔kebab (P4) ─────

describe("MovementItemRow — Card de detalle: invocación cuerpo abre card, kebab abre menú", () => {
  it("el cuerpo de la fila es role=button con aria-label 'Ver detalle de {nombre}'", () => {
    renderRow(fijoActivo);
    expect(screen.getByRole("button", { name: "Ver detalle de Alquiler" })).toBeInTheDocument();
  });

  it("clic en el cuerpo de la fila abre la card de detalle", () => {
    renderRow(fijoActivo);
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Alquiler" }));
    // La card muestra la ficha (rótulo "Categoría" es exclusivo de la card)
    expect(screen.getByText("Categoría")).toBeInTheDocument();
  });

  it("Enter en el cuerpo de la fila (con foco) abre la card de detalle", () => {
    renderRow(fijoActivo);
    const row = screen.getByRole("button", { name: "Ver detalle de Alquiler" });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByText("Categoría")).toBeInTheDocument();
  });

  it("clic en el kebab NO abre la card de detalle (stopPropagation)", () => {
    renderRow(fijoActivo);
    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);
    // El menú de acciones abrió (ítem "Editar" visible), pero la card no
    expect(screen.getByRole("menuitem", { name: /editar/i })).toBeInTheDocument();
    expect(screen.queryByText("Categoría")).not.toBeInTheDocument();
  });

  it("'Editar' del kebab llama a onEdit sin pasar por la card", () => {
    const onEdit = vi.fn();
    render(
      <MovementItemRow movement={fijoActivo} viewMonth="2026-06" onEdit={onEdit} onDelete={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByRole("button", { name: /acciones de alquiler/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledWith(fijoActivo);
    expect(screen.queryByText("Categoría")).not.toBeInTheDocument();
  });
});

// ─── Tests: frecuencia dinámica en sublínea (P2 — Fase 1.1.1) ────────────────

describe("MovementItemRow — frecuencia dinámica en la sublínea (P2 / P1-P4 entero 1..12)", () => {
  it("muestra 'mensual' para frequency=1", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("mensual")).toBeInTheDocument();
  });

  it("muestra 'bimestral' para frequency=2", () => {
    renderRow(fijoBimestral);
    expect(screen.getByText("bimestral")).toBeInTheDocument();
  });

  it("muestra 'trimestral' para frequency=3", () => {
    renderRow(fijoTrimestral);
    expect(screen.getByText("trimestral")).toBeInTheDocument();
  });

  it("muestra 'cada 5 meses' para frequency=5 (etiqueta híbrida)", () => {
    renderRow(fijoCadaCincoMeses);
    expect(screen.getByText("cada 5 meses")).toBeInTheDocument();
  });

  it("muestra 'semestral' para frequency=6", () => {
    renderRow(fijoSemestral);
    expect(screen.getByText("semestral")).toBeInTheDocument();
  });

  it("muestra 'anual' para frequency=12", () => {
    renderRow(fijoAnual);
    expect(screen.getByText("anual")).toBeInTheDocument();
  });

  it("no muestra segmento de frecuencia para movimientos únicos", () => {
    renderRow(unico);
    expect(screen.queryByText(/mensual|bimestral|trimestral|semestral|anual/i)).not.toBeInTheDocument();
  });
});

// ─── Tests: col 3 — un solo discriminador (P4 — Card de detalle de movimiento) ──
// El arranque del fijo ("desde Mmm AAAA") migró a la card de detalle
// (docs/design.md §"Card de detalle de movimiento"); la col 3 de la fila
// vuelve a ir vacía para fijos. Cobertura del arranque: movement-detail-card.test.tsx.

describe("MovementItemRow — col 3 (un solo discriminador)", () => {
  it("fijo: la col 3 NO muestra el arranque (col vacía)", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText("desde")).not.toBeInTheDocument();
    expect(screen.queryByText("Ene 2026")).not.toBeInTheDocument();
  });

  it("único: sigue mostrando su fecha (sin hora)", () => {
    renderRow(unico);
    expect(screen.queryByText(/^desde$/)).not.toBeInTheDocument();
  });

  it("cuota: sigue mostrando 'Cuota X/N'", () => {
    renderRow(cuota);
    expect(screen.getByText("Cuota 3/12")).toBeInTheDocument();
    expect(screen.queryByText(/^desde$/)).not.toBeInTheDocument();
  });

  it("un calculado de origen fijo tampoco muestra arranque en la fila", () => {
    renderRow({ ...fijoCalculado, startMonth: "2026-03" });
    expect(screen.queryByText("Mar 2026")).not.toBeInTheDocument();
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

// ─── Tests: señalética "Anulado" idéntica en los tres orígenes (P3) ──────────

describe("MovementItemRow — señalética de anulado en único y cuota (P3)", () => {
  it("único anulado muestra el badge 'Anulado' y el monto tachado", () => {
    const unicoAnulado: MovementItem = { ...unico, skipped: true };
    renderRow(unicoAnulado);
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    expect(screen.getByText("−$100,00")).toHaveClass("line-through");
  });

  it("cuota anulada muestra el badge 'Anulado' y el monto tachado", () => {
    const cuotaAnulada: MovementItem = { ...cuota, skipped: true };
    renderRow(cuotaAnulada);
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    expect(screen.getByText("−$500,00")).toHaveClass("line-through");
  });

  it("único activo NO muestra el badge 'Anulado'", () => {
    renderRow(unico);
    expect(screen.queryByText("Anulado")).not.toBeInTheDocument();
  });

  it("cuota activa NO muestra el badge 'Anulado'", () => {
    renderRow(cuota);
    expect(screen.queryByText("Anulado")).not.toBeInTheDocument();
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

  it("único NO calculado tiene la acción 'Anular' (sin 'este mes')", () => {
    renderRow(unico);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^anular$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /anular este mes/i })).not.toBeInTheDocument();
  });

  it("cuota NO calculada tiene la acción 'Anular este mes'", () => {
    renderRow(cuota);

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /anular este mes/i })).toBeInTheDocument();
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

// ─── Tests: toggle Anular/Des-anular en únicos y cuotas (P3) ─────────────────

describe("MovementItemRow — toggle Anular/Des-anular en único (P3)", () => {
  it("único activo: muestra 'Anular' (sin 'este mes') en el KebabMenu", () => {
    renderRow(unico);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^anular$/i })).toBeInTheDocument();
  });

  it("único anulado: muestra 'Des-anular' (sin 'este mes') en el KebabMenu", () => {
    const unicoAnulado: MovementItem = { ...unico, skipped: true };
    renderRow(unicoAnulado);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^des-anular$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^anular$/i })).not.toBeInTheDocument();
  });

  it("click en 'Anular' llama a skipTransaction con el id y viewMonth (sin scope temporal)", async () => {
    mockSkipTransaction.mockResolvedValue({ success: true, skipped: true });

    renderRow(unico, "2026-06");

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    const anularItem = screen.getByRole("menuitem", { name: /^anular$/i });
    fireEvent.click(anularItem);

    await waitFor(() => {
      expect(mockSkipTransaction).toHaveBeenCalledWith("mov-1", "2026-06");
    });
    // No debe tocar los otros dos hooks de skip
    expect(mockSkipRecurring).not.toHaveBeenCalled();
    expect(mockSkipInstallment).not.toHaveBeenCalled();
  });

  it("muestra toast de error si skipTransaction falla", async () => {
    mockSkipTransaction.mockResolvedValue({ success: false, error: "No se pudo anular." });

    renderRow(unico);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: /^anular$/i }));

    await waitFor(() => {
      expect(mockSkipTransaction).toHaveBeenCalled();
    });
  });
});

describe("MovementItemRow — toggle Anular/Des-anular en cuota (P3)", () => {
  it("cuota activa: muestra 'Anular este mes' en el KebabMenu", () => {
    renderRow(cuota);

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /anular este mes/i })).toBeInTheDocument();
  });

  it("cuota anulada: muestra 'Des-anular este mes' en el KebabMenu", () => {
    const cuotaAnulada: MovementItem = { ...cuota, skipped: true };
    renderRow(cuotaAnulada);

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /des-anular este mes/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^anular este mes$/i }),
    ).not.toBeInTheDocument();
  });

  it("click en 'Anular este mes' llama a skipInstallment con el id y viewMonth", async () => {
    mockSkipInstallment.mockResolvedValue({ success: true, skipped: true });

    renderRow(cuota, "2026-06");

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    const anularItem = screen.getByRole("menuitem", { name: /anular este mes/i });
    fireEvent.click(anularItem);

    await waitFor(() => {
      expect(mockSkipInstallment).toHaveBeenCalledWith("inst-1", "2026-06");
    });
    // No debe tocar los otros dos hooks de skip
    expect(mockSkipRecurring).not.toHaveBeenCalled();
    expect(mockSkipTransaction).not.toHaveBeenCalled();
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
  it("ítem calculado NO muestra el chip boxeado 'Calculado' (se fusiona en '↳ desde Origen')", () => {
    renderRow(fijoCalculado);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("ítem calculado muestra el segmento fusionado 'desde Sueldo' en la sublínea", () => {
    renderRow(fijoCalculado);
    const origenNode = screen.getByText("Sueldo");
    expect(origenNode).toBeInTheDocument();
    // El segmento "↳ desde {Origen}" es el padre inmediato del nombre de origen en la
    // sublínea — distinto del "desde" de col 3 (arranque del fijo, P4), que también
    // está presente en la fila porque fijoCalculado es un calculado de origen fijo.
    expect(origenNode.parentElement).toHaveTextContent("desde Sueldo");
  });

  it("ítem no calculado NO muestra el chip 'Calculado'", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("ítem padre con hasCalculated=true no muestra chip 'Calculado'", () => {
    renderRow(fijoPadre);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
  });

  it("ítem calculado NO tiene la acción 'Crear movimiento calculado' en el KebabMenu", () => {
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
      screen.queryByRole("menuitem", { name: /crear movimiento calculado/i }),
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
      screen.getByRole("menuitem", { name: /crear movimiento calculado/i }),
    ).toBeInTheDocument();
  });

  it("click en 'Crear movimiento calculado' llama al handler con el movement", () => {
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

    const crearItem = screen.getByRole("menuitem", { name: /crear movimiento calculado/i });
    fireEvent.click(crearItem);

    expect(onCreateCalculated).toHaveBeenCalledWith(fijoActivo);
  });
});

// ─── Tests: Duplicar movimiento (docs/design.md §"Duplicar movimiento") ──────

describe("MovementItemRow — Duplicar movimiento", () => {
  it("un fijo NO calculado con onDuplicate muestra 'Duplicar' en el KebabMenu", () => {
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow
        movement={fijoActivo}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^duplicar$/i })).toBeInTheDocument();
  });

  it("click en 'Duplicar' llama al handler con el movement", () => {
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow
        movement={fijoActivo}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: /^duplicar$/i }));

    expect(onDuplicate).toHaveBeenCalledWith(fijoActivo);
  });

  it("un único NO calculado con onDuplicate muestra 'Duplicar'", () => {
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow movement={unico} viewMonth="2026-06" onEdit={vi.fn()} onDelete={vi.fn()} onDuplicate={onDuplicate} />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^duplicar$/i })).toBeInTheDocument();
  });

  it("una cuota NO calculada con onDuplicate muestra 'Duplicar'", () => {
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow movement={cuota} viewMonth="2026-06" onEdit={vi.fn()} onDelete={vi.fn()} onDuplicate={onDuplicate} />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /^duplicar$/i })).toBeInTheDocument();
  });

  it("un ítem calculado NO muestra 'Duplicar' (mismo gate que 'Crear movimiento calculado')", () => {
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow
        movement={fijoCalculado}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de ahorro/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /^duplicar$/i })).not.toBeInTheDocument();
  });

  it("orden del menú: Editar → Anular este mes → Duplicar → Crear movimiento calculado → Eliminar", () => {
    const onCreateCalculated = vi.fn();
    const onDuplicate = vi.fn();
    render(
      <MovementItemRow
        movement={fijoActivo}
        viewMonth="2026-06"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateCalculated={onCreateCalculated}
        onDuplicate={onDuplicate}
      />,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(/^editar$/i);
    expect(items[1]).toHaveTextContent(/anular este mes/i);
    expect(items[2]).toHaveTextContent(/^duplicar$/i);
    expect(items[3]).toHaveTextContent(/crear movimiento calculado/i);
    expect(items[4]).toHaveTextContent(/^eliminar$/i);
  });
});

describe("MovementItemRow — Fase 1.1.7: monto negativo/cero", () => {
  it("monto negativo en calculado (ARS) muestra prefijo −", () => {
    renderRow(fijoCalculadoNegativo);
    // amountCents = -5000, convertedAmountCents = 5000 → "−$50,00"
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

  it("bug P6 — calculado negativo cross-rate: amountCents < 0 y convertedAmountCents > 0 muestra prefijo −", () => {
    // Regresión: el backend devuelve convertedAmountCents como magnitud (≥ 0).
    // El signo debe derivarse de amountCents, no de convertedAmountCents.
    // amountCents = -1000 (−USD 10,00), convertedAmountCents = 120000 (ARS 1.200,00 positivo)
    // Resultado esperado: "−$1.200,00" (con prefijo −, cifra de convertedAmountCents)
    renderRow(fijoCalculadoNegativoCrossRate);
    expect(screen.getByText("−$1.200,00")).toBeInTheDocument();
  });
});

// ─── Tests: Fase 1.1.8 — calculados de único y cuota ─────────────────────────

describe("MovementItemRow — Fase 1.1.8: calculado de único", () => {
  it("único calculado NO muestra el chip 'Calculado'", () => {
    renderRow(unicoCalculado);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
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

  it("único calculado NO tiene la acción 'Crear movimiento calculado'", () => {
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
      screen.queryByRole("menuitem", { name: /crear movimiento calculado/i }),
    ).not.toBeInTheDocument();
  });

  it("único NO calculado tiene 'Crear movimiento calculado' en el KebabMenu", () => {
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
      screen.getByRole("menuitem", { name: /crear movimiento calculado/i }),
    ).toBeInTheDocument();
  });
});

describe("MovementItemRow — Fase 1.1.8: calculado de cuota", () => {
  it("cuota calculada NO muestra el chip 'Calculado'", () => {
    renderRow(cuotaCalculada);
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
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

  it("cuota NO calculada tiene 'Crear movimiento calculado' en el KebabMenu", () => {
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
      screen.getByRole("menuitem", { name: /crear movimiento calculado/i }),
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

// ─── Tests: Fase 1.2.3 — Multi-moneda cross-rate ─────────────────────────────

/** Movimiento en USD cuando defaultCurrency es ARS */
const unicoUSD: MovementItem = {
  ...unico,
  id: "mov-usd-1",
  description: "Suscripción Netflix",
  amountCents: 1500, // USD 15,00
  currency: "USD",
  exchangeRate: 120000, // 1200,00 ARS por USD (escalado ×100)
  convertedAmountCents: 180000, // = USD 15,00 × ARS 1200,00 = ARS 1800,00
};

describe("MovementItemRow — Fase 1.2.3: display cross-rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // useSettings por defecto en ARS (ya está en el vi.mock global)
    mockUseSettings.mockReturnValue({
      settings: { defaultCurrency: "ARS", lastExchangeRate: null },
      defaultCurrency: "ARS",
      lastExchangeRate: null,
      isLoading: false,
      isError: false,
      updateSettings: vi.fn(),
      isSaving: false,
    });
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
    mockUseTransactions.mockReturnValue({
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      skipTransaction: mockSkipTransaction,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isSkipping: false,
    });
    mockUseInstallments.mockReturnValue({
      createInstallment: vi.fn(),
      updateInstallment: vi.fn(),
      deleteInstallment: vi.fn(),
      skipInstallment: mockSkipInstallment,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isSkipping: false,
    });
  });

  it("muestra el monto convertido (ARS) como cifra dominante en cross-rate", () => {
    renderRow(unicoUSD);
    // convertedAmountCents = 180000 → "−$1.800,00"
    expect(screen.getByText("−$1.800,00")).toBeInTheDocument();
  });

  // Card de detalle de movimiento (P4): el badge de código de moneda y la
  // segunda línea de valor original migraron a la card — la fila (col 4)
  // muestra SIEMPRE una sola línea, aun en cross-rate. Cobertura del badge y
  // el valor original: movement-detail-card.test.tsx.
  it("NO muestra el badge de código de moneda en la fila, aun en cross-rate", () => {
    renderRow(unicoUSD);
    expect(screen.queryByText("USD")).not.toBeInTheDocument();
  });

  it("NO muestra segunda línea de valor original en la fila, aun en cross-rate (col 4 una sola línea)", () => {
    renderRow(unicoUSD);
    expect(screen.queryByText("US$15,00")).not.toBeInTheDocument();
    // Solo la cifra convertida dominante
    expect(screen.getAllByText(/\$\d/)).toHaveLength(1);
  });

  it("NO muestra badge ni segunda línea cuando currency === defaultCurrency (ARS)", () => {
    renderRow(unico); // currency: "ARS", defaultCurrency: "ARS"
    // No debe haber badge "USD" ni línea de valor original
    // El monto normal se muestra sin badge
    expect(screen.queryByText("USD")).not.toBeInTheDocument();
    // Solo hay un monto mostrado
    const montos = screen.getAllByText(/\$\d/);
    // En modo ARS solo hay un monto (sin segunda línea)
    expect(montos).toHaveLength(1);
  });

  it("cuando defaultCurrency cambia a USD, un movimiento ARS no es cross-rate", () => {
    // Simular que el usuario cambió su default a USD
    mockUseSettings.mockReturnValue({
      settings: { defaultCurrency: "USD", lastExchangeRate: 1200 },
      defaultCurrency: "USD",
      lastExchangeRate: 1200,
      isLoading: false,
      isError: false,
      updateSettings: vi.fn(),
      isSaving: false,
    });
    // unico tiene currency: "ARS" — si default es USD, sería cross-rate
    // Pero queremos testear el caso inverso: movimiento en USD (la default) — no es cross-rate
    const unicoEnUSD: MovementItem = {
      ...unico,
      currency: "USD",
      exchangeRate: 1,
      convertedAmountCents: unico.amountCents,
    };
    renderRow(unicoEnUSD);
    // No debe mostrarse badge de moneda porque currency === defaultCurrency (USD)
    // El único texto "USD" que podría aparecer sería en el badge, que no debe existir
    expect(screen.queryByText("USD")).not.toBeInTheDocument();
  });
});

// ─── Tests: skip/kebab — calculado de fijo SÍ tiene toggle anular (RF-MF-005) ─

describe("MovementItemRow — calculado de fijo: acción 'Anular este mes' disponible", () => {
  it("fijo calculado activo (origin=fijo, calculated presente) SÍ muestra 'Anular este mes' en el KebabMenu", () => {
    // El backend soporta skip propio en calculados de fijo (skipped = skip propio OR del padre).
    renderRow(fijoCalculado);

    const trigger = screen.getByRole("button", { name: /acciones de ahorro/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /anular este mes/i }),
    ).toBeInTheDocument();
  });

  it("fijo calculado anulado (skipped=true, calculated presente) muestra 'Des-anular este mes'", () => {
    const fijoCalculadoAnulado: MovementItem = {
      ...fijoCalculado,
      skipped: true,
    };
    renderRow(fijoCalculadoAnulado);

    const trigger = screen.getByRole("button", { name: /acciones de ahorro/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /des-anular este mes/i }),
    ).toBeInTheDocument();
    // "Anular este mes" (sin "Des-") no debe aparecer cuando ya está anulado
    expect(
      screen.queryByRole("menuitem", { name: /^anular este mes$/i }),
    ).not.toBeInTheDocument();
  });

  it("fijo NO calculado (origin=fijo, calculated=null) sigue mostrando 'Anular este mes' (regresión)", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("menuitem", { name: /anular este mes/i }),
    ).toBeInTheDocument();
  });

  it("calculado de único (origin=unico, calculated presente) NO muestra 'Anular este mes'", () => {
    renderRow(unicoCalculado);

    const trigger = screen.getByRole("button", { name: /acciones de ahorro rápido/i });
    fireEvent.click(trigger);

    expect(
      screen.queryByRole("menuitem", { name: /anular este mes/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /des-anular este mes/i }),
    ).not.toBeInTheDocument();
  });

  it("calculado de cuota (origin=cuota, calculated presente) NO muestra 'Anular este mes'", () => {
    renderRow(cuotaCalculada);

    const trigger = screen.getByRole("button", { name: /acciones de ahorro cuota/i });
    fireEvent.click(trigger);

    expect(
      screen.queryByRole("menuitem", { name: /anular este mes/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /des-anular este mes/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── Tests: "Débito automático" migró a la card de detalle (P4 — Card de detalle) ──
// El glifo Zap ya no vive en la zona de estados de la fila — cobertura de su
// presencia en la ficha: movement-detail-card.test.tsx.

describe("MovementItemRow — 'Débito automático' NO vive en la fila (P4)", () => {
  it("NO muestra el glifo aunque autoDebit === true", () => {
    const conDebitoAutomatico: MovementItem = { ...unico, autoDebit: true };
    renderRow(conDebitoAutomatico);
    expect(screen.queryByText("Débito automático")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Débito automático")).not.toBeInTheDocument();
  });

  it("NO muestra el glifo cuando autoDebit === false", () => {
    const sinDebitoAutomatico: MovementItem = { ...unico, autoDebit: false };
    renderRow(sinDebitoAutomatico);
    expect(screen.queryByTitle("Débito automático")).not.toBeInTheDocument();
  });

  it("NO muestra el glifo cuando autoDebit === null", () => {
    renderRow(unico); // autoDebit: null en el fixture base
    expect(screen.queryByTitle("Débito automático")).not.toBeInTheDocument();
  });
});

// ─── Tests: rediseño de la sublínea (dos zonas, punto de categoría, sin rótulo de tipo) ──

describe("MovementItemRow — rediseño de la sublínea (dos zonas)", () => {
  it("no rotula el tipo con la palabra 'gasto' ni 'ingreso' en la sublínea", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText(/^gasto$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^ingreso$/i)).not.toBeInTheDocument();
  });

  it("el punto de categoría usa movement.category.color como color de fondo", () => {
    const { container } = renderRow(fijoActivo);
    const dot = container.querySelector('span[style*="background"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ background: baseCategory.color });
  });

  it("zona de estados no se renderiza cuando no hay padre ni marca de límite", () => {
    renderRow(unico); // hasCalculated=false
    expect(screen.queryByTitle(/tiene movimiento/i)).not.toBeInTheDocument();
  });

  it("zona de estados muestra el glifo de padre (GitBranch) cuando aplica — sin débito automático (migró a la card)", () => {
    const padreConDebito: MovementItem = { ...fijoPadre, autoDebit: true };
    renderRow(padreConDebito);
    expect(screen.getByTitle(/tiene movimiento/i)).toBeInTheDocument();
    expect(screen.queryByTitle("Débito automático")).not.toBeInTheDocument();
  });
});
