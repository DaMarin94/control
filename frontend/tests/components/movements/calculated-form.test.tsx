/**
 * Tests del formulario de movimiento calculado (RF-MCALC-001/002/003/006 — Fase 1.1.7).
 *
 * Verifica:
 * - No existe selector de Tipo (Gasto/Ingreso) — RF-MCALC-003 (tipo derivado, no elegido).
 * - El badge de tipo derivado aparece en el bloque Resultado según el signo del monto.
 * - El badge muestra "Gasto" para resultado negativo y cero, "Ingreso" para positivo.
 * - El payload enviado al crear NO incluye `type`.
 * - El payload enviado al editar NO incluye `type`.
 * - El badge no se muestra cuando hay error de operando (÷/% con 0).
 * - Bloques presentes: Origen, Fórmula, Signo del resultado, Resultado, Categoría, Descripción.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculatedForm } from "@/components/movements/calculated-form";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";
import type { Category } from "@/types/category";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/use-calculated", () => ({
  useCalculated: vi.fn(),
}));

// El toast de "Deshacer" en edición usa useUndoHistory — mockeado para no
// depender de useApi/useSession real en este test de formulario.
vi.mock("@/hooks/use-history", () => ({
  useUndoHistory: vi.fn(() => ({ undo: vi.fn(), isUndoing: false })),
}));

// Mock de use-settings — defaultCurrency ARS (usado por la conversión canónica
// de la intercepción de límites, P2 — Fase 2 extendida a calculado).
vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    settings: { defaultCurrency: "ARS", lastExchangeRate: 1200 },
    defaultCurrency: "ARS",
    lastExchangeRate: 1200,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  })),
}));

// P2 — Fase 2 (extensión a calculado): intercepción de límites activos. Por
// defecto sin límites (cero fricción); los tests de la compuerta lo sobreescriben.
vi.mock("@/hooks/use-active-limit-projection", () => ({
  useActiveLimitProjection: vi.fn(() => ({ evaluate: vi.fn(() => []) })),
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

// CategoryFormModal no lo testeamos aquí
vi.mock("@/app/(app)/configuracion/categorias/category-form-modal", () => ({
  CategoryFormModal: vi.fn(() => null),
}));

import { useCategories } from "@/hooks/use-categories";
import { useCalculated } from "@/hooks/use-calculated";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";

const mockUseCategories = vi.mocked(useCategories);
const mockUseCalculated = vi.mocked(useCalculated);
const mockUseActiveLimitProjection = vi.mocked(useActiveLimitProjection);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockExpenseCategory: Category = {
  id: "cat-expense",
  userId: "user-1",
  name: "Servicios",
  scope: "EXPENSE",
  color: "#FF5733",
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

const mockIncomeCategory: Category = {
  id: "cat-income",
  userId: "user-1",
  name: "Sueldo",
  scope: "INCOME",
  color: "#00FF00",
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

const mockBothCategory: Category = {
  id: "cat-both",
  userId: "user-1",
  name: "Varios",
  scope: "BOTH",
  color: "#0000FF",
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

/** Ítem fijo de origen (desde el que se crea el calculado) */
const origenFijo: MovementItem = {
  id: "rec-origen",
  origin: "fijo",
  type: "INCOME",
  amountCents: 100000, // $1.000,00
  description: "Sueldo",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2026-01",
  endMonth: null,
  chainId: "chain-origen-fijo",
  skipped: false,
  category: { id: "cat-income", name: "Sueldo", color: "#00FF00", scope: "INCOME" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 100000,
  simulated: false,
  calculatedChildren: [],
};

/** Ítem único de origen — Fase 1.1.8 */
const origenUnico: MovementItem = {
  id: "trans-origen",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 50000, // $500,00
  description: "Compra",
  occurredAt: "2026-06-10T12:00:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  chainId: null,
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
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

/** Ítem cuota de origen — Fase 1.1.8 */
const origenCuota: MovementItem = {
  id: "inst-group-origen",
  origin: "cuota",
  type: "EXPENSE",
  amountCents: 30000, // $300,00
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: { number: 2, total: 6, startMonth: "2026-05" },
  frequency: null,
  startMonth: null,
  endMonth: null,
  chainId: null,
  skipped: false,
  category: { id: "cat-expense", name: "Tecnología", color: "#0000FF", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 30000,
  simulated: false,
  calculatedChildren: [],
};

/** Ítem calculado (para modo editar — origen fijo) */
const calculadoExistente: MovementItem = {
  id: "calc-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: -10000, // −$100,00
  description: "Ahorro",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2026-01",
  endMonth: null,
  // Un calculado de fijo ES un fijo con cadena PROPIA (distinta de sourceChainId).
  chainId: "chain-calc-1",
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: {
    sourceType: "fijo",
    sourceChainId: "chain-orig",
    sourceId: "rec-origen",
    sourceDescription: "Sueldo",
    formulaOperator: "PCT",
    formulaOperand: 1000, // 10%
    formulaSign: -1,
    sourceAmountCents: 100000,
  },
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: -10000,
  simulated: false,
  calculatedChildren: [],
};

/** Ítem calculado de origen único (para modo editar — Fase 1.1.8) */
const calculadoUnicoExistente: MovementItem = {
  id: "calc-unico-1",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 5000,
  description: "Comisión",
  occurredAt: "2026-06-10T12:00:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  chainId: null,
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: {
    sourceType: "unico",
    sourceChainId: null, // null para origen único
    sourceId: "trans-origen",
    sourceDescription: "Compra",
    formulaOperator: "PCT",
    formulaOperand: 1000, // 10%
    formulaSign: 1,
    sourceAmountCents: 50000,
  },
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 5000,
  simulated: false,
  calculatedChildren: [],
};

/** Ítem calculado (origen fijo), pero YA anulado — alimenta el test de D16 */
const calculadoSkippedExistente: MovementItem = {
  ...calculadoExistente,
  id: "calc-skip-1",
  skipped: true,
};

/** Ítem fijo de origen en USD (para el test de conversión canónica, D17) */
const origenFijoUsd: MovementItem = {
  ...origenFijo,
  id: "rec-origen-usd",
  amountCents: 10000, // USD 100,00
  currency: "USD",
  exchangeRate: 1000, // 1 USD = 1000 ARS
  convertedAmountCents: 10000000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCreateCalculated = vi.fn();
const mockUpdateCalculated = vi.fn();

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

function renderCreate(origenMovement: MovementItem = origenFijo, onClose = vi.fn()) {
  return render(
    <CalculatedForm mode="create" movement={origenMovement} onClose={onClose} viewMonth="2026-06" />,
    { wrapper: createWrapper() },
  );
}

function renderEdit(calculado: MovementItem = calculadoExistente, onClose = vi.fn()) {
  return render(
    <CalculatedForm mode="edit" movement={calculado} onClose={onClose} viewMonth="2026-06" />,
    { wrapper: createWrapper() },
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockUseCategories.mockReturnValue({
    categories: [mockExpenseCategory, mockIncomeCategory, mockBothCategory],
    isLoading: false,
    isError: false,
    error: null,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reactivateCategory: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReactivating: false,
  });

  mockUseCalculated.mockReturnValue({
    createCalculated: mockCreateCalculated,
    updateCalculated: mockUpdateCalculated,
    isCreating: false,
    isUpdating: false,
  });

  // P2 — Fase 2 (extensión a calculado): por defecto sin cruces (cero fricción)
  // — los tests de la compuerta sobreescriben con mockUseActiveLimitProjection.mockReturnValue(...).
  mockUseActiveLimitProjection.mockReturnValue({ evaluate: vi.fn(() => []) });
});

// ─── Tests: estructura del formulario ─────────────────────────────────────────

describe("CalculatedForm — estructura del form", () => {
  it("renderiza el bloque Origen con el nombre del fijo origen", () => {
    renderCreate();
    // "Origen" aparece dos veces: como Label y como chip prefijo del segmented
    const origenElements = screen.getAllByText("Origen");
    expect(origenElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sueldo")).toBeInTheDocument();
  });

  it("renderiza el bloque Fórmula con operadores", () => {
    renderCreate();
    expect(screen.getByText("Fórmula")).toBeInTheDocument();
    // Segmented tiene los 5 operadores
    expect(screen.getByRole("button", { name: /suma/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /porcentaje/i })).toBeInTheDocument();
  });

  it("renderiza el bloque Signo del resultado con Positivo/Negativo", () => {
    renderCreate();
    expect(screen.getByText("Signo del resultado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /positivo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /negativo/i })).toBeInTheDocument();
  });

  it("renderiza el bloque Resultado", () => {
    renderCreate();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  it("renderiza el bloque Categoría", () => {
    renderCreate();
    expect(screen.getByText("Categoría")).toBeInTheDocument();
  });

  it("renderiza el bloque Descripción", () => {
    renderCreate();
    expect(screen.getByText(/descripción/i)).toBeInTheDocument();
  });
});

// ─── Tests: NO hay selector de Tipo (RF-MCALC-003) ───────────────────────────

describe("CalculatedForm — sin selector de Tipo (RF-MCALC-003)", () => {
  it("NO existe el botón 'Gasto' como control de selección de tipo", () => {
    renderCreate();
    // El word "Gasto" puede aparecer como badge derivado, no como botón de tipo
    // Verificamos que no haya un botón de toggle tipo
    const buttons = screen.getAllByRole("button");
    const tipoButtons = buttons.filter(
      (btn) =>
        (btn.textContent?.includes("Gasto") || btn.textContent?.includes("Ingreso")) &&
        btn.classList.contains("border-[1.5px]"),
    );
    expect(tipoButtons).toHaveLength(0);
  });

  it("NO existe el botón 'Ingreso' como control de selección de tipo", () => {
    renderCreate();
    // Igual que arriba: no debe haber un botón de tipo editable
    // (el badge en Resultado no es un botón)
    const ingresoButtons = screen.queryAllByRole("button", { name: /^ingreso$/i });
    expect(ingresoButtons).toHaveLength(0);
  });

  it("en modo edición tampoco hay selector de Tipo", () => {
    renderEdit();
    const ingresoButtons = screen.queryAllByRole("button", { name: /^ingreso$/i });
    const gastoButtons = screen.queryAllByRole("button", { name: /^gasto$/i });
    expect(ingresoButtons).toHaveLength(0);
    expect(gastoButtons).toHaveLength(0);
  });
});

// ─── Tests: badge de tipo derivado en el bloque Resultado ─────────────────────

describe("CalculatedForm — badge de tipo derivado (spec 3.4)", () => {
  it("con signo positivo y operando válido, muestra badge 'Ingreso'", async () => {
    const user = userEvent.setup();
    renderCreate();

    // Origen es $1.000,00 (100000 centavos), signo default "Positivo"
    // El input de operando tiene name="operandInput" (placeholder "10" en modo PCT)
    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    // Con positivo: 10% de 100000 = 10000 > 0 → INCOME → badge "Ingreso"
    await waitFor(() => {
      expect(screen.getByLabelText("Tipo derivado: Ingreso")).toBeInTheDocument();
    });
  });

  it("con signo negativo y operando válido, muestra badge 'Gasto'", async () => {
    const user = userEvent.setup();
    renderCreate();

    // Cambiar a Negativo
    await user.click(screen.getByRole("button", { name: /negativo/i }));

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    // 10% de 100000 = 10000, × (-1) = -10000 < 0 → EXPENSE → badge "Gasto"
    await waitFor(() => {
      expect(screen.getByLabelText("Tipo derivado: Gasto")).toBeInTheDocument();
    });
  });

  it("con operando 0 y operador PCT no muestra badge (error de operando)", async () => {
    const user = userEvent.setup();
    renderCreate();

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "0");

    // PCT con 0 → error, no hay badge
    await waitFor(() => {
      expect(screen.queryByLabelText("Tipo derivado: Gasto")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Tipo derivado: Ingreso")).not.toBeInTheDocument();
      // Mensaje de error de operando sí está
      expect(screen.getByText(/el porcentaje no puede ser 0/i)).toBeInTheDocument();
    });
  });

  it("en modo edición muestra el badge derivado de los valores precargados", () => {
    renderEdit();
    // formulaSign: -1, PCT 10%, sourceAmountCents: 100000
    // -1 × round(100000 × 10 / 100) = -10000 → EXPENSE → "Gasto"
    expect(screen.getByLabelText("Tipo derivado: Gasto")).toBeInTheDocument();
  });
});

// ─── Tests: payload sin `type` al crear ───────────────────────────────────────

describe("CalculatedForm — payload de create no incluye type (RF-MCALC-003)", () => {
  it("createCalculated se llama sin campo 'type' en el payload", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-1" });

    render(
      <CalculatedForm mode="create" movement={origenFijo} onClose={onClose} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    // Ingresamos operando "10" (placeholder "10" en modo PCT)
    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    // Elegimos una categoría INCOME (tipo derivado será INCOME con signo positivo)
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "cat-income");

    // Submit
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateCalculated).toHaveBeenCalledTimes(1);
    });

    const [, callData] = mockCreateCalculated.mock.calls[0] as [string, Record<string, unknown>];
    // El payload NO debe tener `type`
    expect(callData).not.toHaveProperty("type");
    // Sí debe tener los campos del contrato actualizado
    expect(callData).toHaveProperty("categoryId");
    expect(callData).toHaveProperty("startMonth");
    expect(callData).toHaveProperty("formulaOperator");
    expect(callData).toHaveProperty("formulaOperand");
    expect(callData).toHaveProperty("formulaSign");
  });
});

// ─── Tests: límite de largo de descripción ────────────────────────────────────

describe("CalculatedForm — validación de descripción", () => {
  it("muestra 'La descripción no puede superar los 200 caracteres' y bloquea el submit cuando la excede", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CalculatedForm mode="create" movement={origenFijo} onClose={onClose} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "cat-income");

    const descriptionInput = screen.getByLabelText(/descripción/i);
    fireEvent.change(descriptionInput, { target: { value: "a".repeat(201) } });

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/la descripción no puede superar los 200 caracteres/i),
      ).toBeInTheDocument();
    });
    expect(mockCreateCalculated).not.toHaveBeenCalled();
  });
});

// ─── Tests: payload sin `type` al editar ──────────────────────────────────────

describe("CalculatedForm — payload de update no incluye type (RF-MCALC-003)", () => {
  it("updateCalculated se llama sin campo 'type' en el payload", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateCalculated.mockResolvedValue({ success: true, id: "calc-1" });

    render(
      <CalculatedForm mode="edit" movement={calculadoExistente} onClose={onClose} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    // Submit sin modificar nada (los valores están precargados)
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateCalculated).toHaveBeenCalledTimes(1);
    });

    const [, callData] = mockUpdateCalculated.mock.calls[0] as [string, Record<string, unknown>];
    // El payload NO debe tener `type`
    expect(callData).not.toHaveProperty("type");
    // Sí debe tener los campos del contrato actualizado
    expect(callData).toHaveProperty("currentMonth");
    expect(callData).toHaveProperty("categoryId");
    expect(callData).toHaveProperty("formulaOperator");
    expect(callData).toHaveProperty("formulaOperand");
    expect(callData).toHaveProperty("formulaSign");
  });
});

// ─── Tests Fase 1.1.8 — origen único y cuota ─────────────────────────────────

describe("CalculatedForm — Fase 1.1.8: crear desde origen único (sin startMonth)", () => {
  it("createCalculated se llama sin 'startMonth' cuando el origen es único", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-unico" });

    render(
      <CalculatedForm mode="create" movement={origenUnico} onClose={onClose} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    // Ingresamos operando "10"
    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    // Signo default = positivo → resultado > 0 → INCOME → disponibles: cat-income, cat-both
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "cat-income");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateCalculated).toHaveBeenCalledTimes(1);
    });

    const [callId, callData, callSourceType] = mockCreateCalculated.mock.calls[0] as [string, Record<string, unknown>, string];
    expect(callId).toBe("trans-origen");
    // Sin startMonth (no aplica a único)
    expect(callData).not.toHaveProperty("startMonth");
    // Sin type
    expect(callData).not.toHaveProperty("type");
    // sourceType pasado correctamente
    expect(callSourceType).toBe("unico");
  });
});

describe("CalculatedForm — Fase 1.1.8: crear desde origen cuota (sin startMonth)", () => {
  it("createCalculated se llama sin 'startMonth' cuando el origen es cuota", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-cuota" });

    render(
      <CalculatedForm mode="create" movement={origenCuota} onClose={onClose} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");

    // Signo default = positivo → PCT 10% de 30000 = 3000 > 0 → INCOME → cat-income o cat-both
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "cat-income");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateCalculated).toHaveBeenCalledTimes(1);
    });

    const [callId, callData, callSourceType] = mockCreateCalculated.mock.calls[0] as [string, Record<string, unknown>, string];
    expect(callId).toBe("inst-group-origen");
    expect(callData).not.toHaveProperty("startMonth");
    expect(callData).not.toHaveProperty("type");
    expect(callSourceType).toBe("cuota");
  });
});

describe("CalculatedForm — Fase 1.1.8: editar calculado de origen único", () => {
  it("renderiza el bloque Origen con el nombre del origen único", () => {
    render(
      <CalculatedForm mode="edit" movement={calculadoUnicoExistente} onClose={vi.fn()} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );
    // sourceDescription = "Compra"
    expect(screen.getByText("Compra")).toBeInTheDocument();
  });

  it("updateCalculated se llama con sourceType 'unico' al guardar", async () => {
    const user = userEvent.setup();
    mockUpdateCalculated.mockResolvedValue({ success: true, id: "calc-unico-1" });

    render(
      <CalculatedForm mode="edit" movement={calculadoUnicoExistente} onClose={vi.fn()} viewMonth="2026-06" />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateCalculated).toHaveBeenCalledTimes(1);
    });

    const [, , callSourceType] = mockUpdateCalculated.mock.calls[0] as [string, Record<string, unknown>, string];
    expect(callSourceType).toBe("unico");
  });
});

// ─── Tests: intercepción de límites activos (P2 — Fase 2, extensión a calculado) ─

/** Ítem cuota de origen sin categoría compatible con Ingreso — evita depender de otro fixture */
const mockCrossedLimit = {
  id: "l1",
  enabled: true,
  anchorKey: "mes.total.gasto",
  operator: "gt" as const,
  threshold: 100,
  nature: "active" as const,
};

function renderCreateWithMonth(
  origenMovement: MovementItem,
  viewMonth: string,
  onClose = vi.fn(),
) {
  return render(
    <CalculatedForm mode="create" movement={origenMovement} onClose={onClose} viewMonth={viewMonth} />,
    { wrapper: createWrapper() },
  );
}

describe("CalculatedForm — intercepción de límites activos (P2, Fase 2 — extensión a calculado)", () => {
  it("sin cruces: persiste directo, SIN mostrar el aviso (cero fricción)", async () => {
    const user = userEvent.setup();
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-1" });
    const onClose = vi.fn();
    renderCreate(origenFijo, onClose);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateCalculated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con cruces: NO persiste directo, muestra el aviso en vez de guardar", async () => {
    const user = userEvent.setup();
    mockUseActiveLimitProjection.mockReturnValue({
      evaluate: vi.fn(() => [mockCrossedLimit]),
    });
    renderCreate(origenFijo);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(mockCreateCalculated).not.toHaveBeenCalled();
  });

  it("'Cancelar' en el aviso cierra SOLO el aviso — el form sigue abierto e intacto", async () => {
    const user = userEvent.setup();
    mockUseActiveLimitProjection.mockReturnValue({
      evaluate: vi.fn(() => [mockCrossedLimit]),
    });
    const onClose = vi.fn();
    renderCreate(origenFijo, onClose);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    const alertDialog = await screen.findByRole("alertdialog");

    await user.click(within(alertDialog).getByRole("button", { name: /^cancelar$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(mockCreateCalculated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // El operando tipeado sigue en el form
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("'Guardar igual' persiste el movimiento calculado y cierra ambos diálogos", async () => {
    const user = userEvent.setup();
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-1" });
    mockUseActiveLimitProjection.mockReturnValue({
      evaluate: vi.fn(() => [mockCrossedLimit]),
    });
    const onClose = vi.fn();
    renderCreate(origenFijo, onClose);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: /guardar igual/i }));

    await waitFor(() => {
      expect(mockCreateCalculated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("D14: al crear desde un origen fijo evalúa con section 'fijos' y el tipo/monto derivados", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-1" });
    renderCreate(origenFijo);

    // Origen $1.000,00 · signo default Positivo · PCT 10 → 10% de 100000 = 10000 (INCOME)
    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "INCOME",
        convertedAmountCents: 10000,
        categoryId: "cat-income",
        section: "fijos",
        skipped: false,
        editingId: undefined,
      }),
    );
  });

  it("D14: al crear desde un origen único evalúa con section 'unicos'", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-unico" });
    renderCreate(origenUnico);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ section: "unicos", type: "INCOME" }),
    );
  });

  it("D14: al crear desde un origen cuota evalúa con section 'cuotas'", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-cuota" });
    renderCreate(origenCuota);

    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ section: "cuotas", type: "INCOME" }),
    );
  });

  it("D13: calculado de fijo/cuota proyecta sobre el mes en curso real, ignorando viewMonth", () => {
    // getCurrentMonth() está mockeado a "2026-06"; viewMonth difiere a propósito.
    renderCreateWithMonth(origenFijo, "2026-03");
    expect(mockUseActiveLimitProjection).toHaveBeenCalledWith("2026-06");
  });

  it("D13: calculado de cuota también proyecta sobre el mes en curso real, ignorando viewMonth", () => {
    renderCreateWithMonth(origenCuota, "2026-03");
    expect(mockUseActiveLimitProjection).toHaveBeenCalledWith("2026-06");
  });

  it("D13: calculado de único proyecta sobre su propio mes (viewMonth), no el mes en curso", () => {
    renderCreateWithMonth(origenUnico, "2026-03");
    expect(mockUseActiveLimitProjection).toHaveBeenCalledWith("2026-03");
  });

  it("en edición pasa editingId + section/type/monto derivados del calculado (no del origen)", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockUpdateCalculated.mockResolvedValue({ success: true, id: "calc-1" });
    renderEdit(calculadoExistente);

    // Precargado: PCT 10%, signo -1, sourceAmountCents 100000 → -10000 (EXPENSE)
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(mockUpdateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EXPENSE",
        convertedAmountCents: 10000,
        categoryId: "cat-expense",
        section: "fijos",
        skipped: false,
        editingId: "calc-1",
      }),
    );
  });

  it("D16: al editar un calculado YA anulado (movement.skipped=true) evalúa con skipped=true", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockUpdateCalculated.mockResolvedValue({ success: true, id: "calc-skip-1" });
    renderEdit(calculadoSkippedExistente);

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(mockUpdateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(expect.objectContaining({ skipped: true }));
  });

  it("D17: convierte el monto final a la moneda canónica antes de evaluar (origen en USD)", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockCreateCalculated.mockResolvedValue({ success: true, id: "new-calc-usd" });
    renderCreate(origenFijoUsd);

    // Origen USD 100,00 (10000) · PCT 10 · signo positivo → 1000 (USD 10,00) → × 1000 (cotización) = 1.000.000
    const operandoInput = screen.getByPlaceholderText("10");
    await user.clear(operandoInput);
    await user.type(operandoInput, "10");
    await user.selectOptions(screen.getByRole("combobox"), "cat-income");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreateCalculated).toHaveBeenCalled());
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ convertedAmountCents: 1_000_000 }),
    );
  });
});
