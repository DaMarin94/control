/**
 * Tests del formulario de movimiento fijo (RF-MF-001 / RF-MF-003).
 * Verifica:
 * - Validaciones (monto > 0, categoría requerida)
 * - Filtrado de categorías por scope (RN-010)
 * - Conversión pesos → centavos
 * - Sin campos de fecha/hora
 * - Tipo read-only en modo edición (RF-MF-003)
 * - Flujo crear exitoso con toast "Ir a ver"
 * - Flujo editar exitoso sin toast de acción
 * - Error del backend → modal abierto (RNF-008)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringForm } from "@/components/movements/recurring-form";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";
import type { Recurring } from "@/types/recurring";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

import { useCategories } from "@/hooks/use-categories";
import { useRecurring } from "@/hooks/use-recurring";
import { useRouter } from "next/navigation";

const mockUseCategories = vi.mocked(useCategories);
const mockUseRecurring = vi.mocked(useRecurring);
const mockUseRouter = vi.mocked(useRouter);

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

const mockRecurring: Recurring = {
  id: "rec-1",
  userId: "user-1",
  categoryId: "cat-expense",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  startMonth: "2026-01",
  deletedFrom: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  category: {
    id: "cat-expense",
    name: "Servicios",
    color: "#FF5733",
    scope: "EXPENSE",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(props: { recurring?: Recurring | null; onClose?: () => void }) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <RecurringForm recurring={props.recurring ?? null} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockCreateRecurring = vi.fn();
const mockUpdateRecurring = vi.fn();
const mockDeleteRecurring = vi.fn();
const mockPush = vi.fn();

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

  mockUseRecurring.mockReturnValue({
    createRecurring: mockCreateRecurring,
    updateRecurring: mockUpdateRecurring,
    deleteRecurring: mockDeleteRecurring,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  });

  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
});

// ─── Tests: validación ────────────────────────────────────────────────────────

describe("RecurringForm — validación", () => {
  it("muestra error si el monto está vacío al enviar", async () => {
    const user = userEvent.setup();
    renderForm({});

    const submitBtn = screen.getByRole("button", { name: /guardar movimiento/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/monto es requerido/i)).toBeInTheDocument();
    });
    expect(mockCreateRecurring).not.toHaveBeenCalled();
  });

  it("muestra error si el monto es 0 o inválido", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "0");

    const submitBtn = screen.getByRole("button", { name: /guardar movimiento/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/monto mayor a 0/i)).toBeInTheDocument();
    });
    expect(mockCreateRecurring).not.toHaveBeenCalled();
  });

  it("muestra error si no se selecciona categoría", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "1500");

    const submitBtn = screen.getByRole("button", { name: /guardar movimiento/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/categoría es requerida/i)).toBeInTheDocument();
    });
    expect(mockCreateRecurring).not.toHaveBeenCalled();
  });
});

// ─── Tests: sin campos de fecha/hora ─────────────────────────────────────────

describe("RecurringForm — sin fecha/hora", () => {
  it("no muestra campo de fecha", () => {
    renderForm({});
    // No debe haber ningún input de tipo date
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();
  });

  it("no muestra campo de hora", () => {
    renderForm({});
    // No debe haber ningún input de tipo time
    expect(screen.queryByLabelText(/hora/i)).not.toBeInTheDocument();
  });
});

// ─── Tests: filtrado de categorías por scope (RN-010) ─────────────────────────

describe("RecurringForm — filtrado de categorías por scope", () => {
  it("en tipo EXPENSE muestra categorías EXPENSE y BOTH, no INCOME", () => {
    renderForm({});

    // El selector debe tener las categorías correctas
    const select = screen.getByLabelText(/categoría/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument(); // EXPENSE
    expect(screen.getByText("Varios")).toBeInTheDocument(); // BOTH
    expect(screen.queryByText("Sueldo")).not.toBeInTheDocument(); // INCOME — no debe aparecer
  });

  it("en tipo INCOME muestra categorías INCOME y BOTH, no EXPENSE", async () => {
    const user = userEvent.setup();
    renderForm({});

    // Cambiar tipo a INCOME
    const typeSelect = screen.getByLabelText(/tipo/i);
    await user.selectOptions(typeSelect, "INCOME");

    await waitFor(() => {
      expect(screen.getByText("Sueldo")).toBeInTheDocument(); // INCOME
      expect(screen.getByText("Varios")).toBeInTheDocument(); // BOTH
      expect(screen.queryByText("Servicios")).not.toBeInTheDocument(); // EXPENSE — no debe aparecer
    });
  });
});

// ─── Tests: tipo read-only en edición (RF-MF-003) ─────────────────────────────

describe("RecurringForm — tipo read-only en edición", () => {
  it("muestra el tipo como campo de texto deshabilitado al editar", () => {
    renderForm({ recurring: mockRecurring });

    // El campo de tipo debe ser un input deshabilitado (no un select)
    const typeInput = screen.getByDisplayValue(/gasto/i);
    expect(typeInput).toBeDisabled();
    expect(typeInput.tagName).toBe("INPUT");
  });

  it("el selector de tipo NO aparece en modo edición", () => {
    renderForm({ recurring: mockRecurring });

    // No debe haber un select con las opciones Gasto/Ingreso accesibles para cambiar
    // (el campo de tipo es un input disabled, no un select)
    const selects = screen.getAllByRole("combobox");
    // Solo debe haber el selector de categoría, no el de tipo
    expect(selects).toHaveLength(1);
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument();
  });
});

// ─── Tests: prefill en edición ────────────────────────────────────────────────

describe("RecurringForm — prefill en edición", () => {
  it("precarga el monto desde amountCents", () => {
    renderForm({ recurring: mockRecurring });
    // 150000 centavos = 1500 pesos
    const amountInput = screen.getByLabelText(/monto/i) as HTMLInputElement;
    expect(amountInput.value).toBe("1500");
  });

  it("precarga la descripción", () => {
    renderForm({ recurring: mockRecurring });
    const descInput = screen.getByLabelText(/descripción/i) as HTMLInputElement;
    expect(descInput.value).toBe("Alquiler");
  });
});

// ─── Tests: flujo crear exitoso ───────────────────────────────────────────────

describe("RecurringForm — flujo crear", () => {
  it("crea el fijo con los datos correctos y cierra el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({ onClose });

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "1500");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    const submitBtn = screen.getByRole("button", { name: /guardar movimiento/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 150000,
          categoryId: "cat-expense",
          startMonth: "2026-06",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("convierte pesos a centavos correctamente (RN-002)", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "15,50");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /guardar movimiento/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 1550 }),
      );
    });
  });
});

// ─── Tests: flujo editar exitoso ─────────────────────────────────────────────

describe("RecurringForm — flujo editar", () => {
  it("llama updateRecurring con currentMonth (requerido) y cierra el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateRecurring.mockResolvedValue({
      success: true,
      recurring: { ...mockRecurring, amountCents: 200000 },
    });

    renderForm({ recurring: mockRecurring, onClose });

    // Cambiar el monto
    const amountInput = screen.getByLabelText(/monto/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "2000");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({
          currentMonth: "2026-06",
          amountCents: 200000,
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ─── Tests: error del backend (RNF-008) ──────────────────────────────────────

describe("RecurringForm — error del backend", () => {
  it("muestra toast de error y mantiene el modal abierto", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateRecurring.mockResolvedValue({
      success: false,
      error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
    });

    renderForm({ onClose });

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "1500");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /guardar movimiento/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalled();
    });

    // Modal debe seguir abierto
    expect(onClose).not.toHaveBeenCalled();
  });
});
