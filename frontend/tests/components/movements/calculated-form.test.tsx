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
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

// CategoryFormModal no lo testeamos aquí
vi.mock("@/app/(app)/categorias/category-form-modal", () => ({
  CategoryFormModal: vi.fn(() => null),
}));

import { useCategories } from "@/hooks/use-categories";
import { useCalculated } from "@/hooks/use-calculated";

const mockUseCategories = vi.mocked(useCategories);
const mockUseCalculated = vi.mocked(useCalculated);

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
  frequency: "MONTHLY",
  skipped: false,
  category: { id: "cat-income", name: "Sueldo", color: "#00FF00", scope: "INCOME" },
  calculated: null,
  hasCalculated: false,
};

/** Ítem calculado (para modo editar) */
const calculadoExistente: MovementItem = {
  id: "calc-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: -10000, // −$100,00
  description: "Ahorro",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: "MONTHLY",
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
  calculated: {
    sourceChainId: "chain-orig",
    sourceId: "rec-origen",
    sourceDescription: "Sueldo",
    formulaOperator: "PCT",
    formulaOperand: 1000, // 10%
    formulaSign: -1,
    sourceAmountCents: 100000,
  },
  hasCalculated: false,
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
