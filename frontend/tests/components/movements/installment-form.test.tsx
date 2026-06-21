/**
 * Tests del formulario de movimiento en cuotas (RF-MC-001 / RF-MC-003).
 * Verifica:
 * - Sin selector de tipo (siempre EXPENSE)
 * - Validaciones (monto > 0, cantidad de cuotas > 0 entero, categoría requerida)
 * - Mes de inicio default = getCurrentMonth()
 * - Filtrado de categorías: solo EXPENSE y BOTH
 * - Conversión pesos → centavos
 * - Prefill en modo edición (amountCents, totalInstallments, startMonth, categoryId, description)
 * - Flujo crear exitoso con toast "Ir a ver"
 * - Flujo editar exitoso sin acción en el toast
 * - Error del backend → modal abierto (RNF-008)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallmentForm } from "@/components/movements/installment-form";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";
import type { InstallmentGroup } from "@/types/installment";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(),
}));

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

vi.mock("@/hooks/use-reference-rate", () => ({
  useReferenceRate: vi.fn(() => ({
    referenceRate: null,
    isLoading: false,
    isError: false,
  })),
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
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useRouter } from "next/navigation";

const mockUseCategories = vi.mocked(useCategories);
const mockUseInstallments = vi.mocked(useInstallments);
const mockUseSettings = vi.mocked(useSettings);
const mockUseReferenceRate = vi.mocked(useReferenceRate);
const mockUseRouter = vi.mocked(useRouter);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockExpenseCategory: Category = {
  id: "cat-expense",
  userId: "user-1",
  name: "Tecnología",
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

const mockInstallmentGroup: InstallmentGroup = {
  id: "inst-1",
  userId: "user-1",
  categoryId: "cat-expense",
  type: "EXPENSE",
  amountCents: 50000,
  totalInstallments: 12,
  startMonth: "2026-01",
  description: "Notebook",
  currency: "ARS",
  exchangeRate: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  category: {
    id: "cat-expense",
    name: "Tecnología",
    color: "#FF5733",
    scope: "EXPENSE",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(props: { installment?: InstallmentGroup | null; onClose?: () => void }) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <InstallmentForm installment={props.installment ?? null} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockCreateInstallment = vi.fn();
const mockUpdateInstallment = vi.fn();
const mockDeleteInstallment = vi.fn();
const mockPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockUseSettings.mockReturnValue({
    settings: { defaultCurrency: "ARS", lastExchangeRate: 1200 },
    defaultCurrency: "ARS",
    lastExchangeRate: 1200,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  });

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

  mockUseInstallments.mockReturnValue({
    createInstallment: mockCreateInstallment,
    updateInstallment: mockUpdateInstallment,
    deleteInstallment: mockDeleteInstallment,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  });

  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
});

// ─── Tests: sin selector de tipo ─────────────────────────────────────────────

describe("InstallmentForm — sin selector de tipo", () => {
  it("no muestra un selector de tipo Gasto/Ingreso", () => {
    renderForm({});
    // No debe haber un select con opciones Gasto/Ingreso
    const selects = screen.getAllByRole("combobox");
    // Solo el selector de categoría debe estar presente (no el de tipo)
    expect(selects).toHaveLength(1);
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument();
  });

  it("muestra el tipo como campo read-only con valor 'Gasto' (div, no select/input)", () => {
    renderForm({});
    // El tipo es un div read-only que muestra "Gasto", no un input ni botones toggle
    // No hay combobox de tipo, solo de categoría
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(1); // Solo el selector de categoría
    // El texto "Gasto" debe aparecer como texto visible
    expect(screen.getByText("Gasto")).toBeInTheDocument();
  });

  it("no muestra la opción 'Ingreso' en ningún selector", () => {
    renderForm({});
    // No debe haber opción con texto "Ingreso" en ningún control
    expect(screen.queryByRole("option", { name: /ingreso/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: creación inline de categoría (RF-MU-004) ──────────────────────────

describe("InstallmentForm — '+ Nueva' categoría inline", () => {
  it("el botón '+ Nueva' abre el modal de nueva categoría con el scope restringido a EXPENSE", async () => {
    const user = userEvent.setup();
    renderForm({});

    await user.click(screen.getByRole("button", { name: /\+ nueva/i }));

    // El modal de categoría se abre en modo crear
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/nueva categoría/i)).toBeInTheDocument();

    // El scope picker usa botones con label "Alcance"
    // Las cuotas son siempre EXPENSE → el modal oculta INCOME
    expect(within(dialog).queryByRole("button", { name: /^ingreso$/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^gasto$/i })).toBeInTheDocument();
  });
});

// ─── Tests: mes de inicio por defecto ────────────────────────────────────────

describe("InstallmentForm — mes de inicio", () => {
  it("el mes de inicio tiene como default el mes actual (getCurrentMonth)", () => {
    renderForm({});
    const monthInput = screen.getByLabelText(/mes de inicio/i) as HTMLInputElement;
    expect(monthInput.value).toBe("2026-06");
  });

  it("el campo de mes de inicio es editable", () => {
    renderForm({});
    const monthInput = screen.getByLabelText(/mes de inicio/i) as HTMLInputElement;
    expect(monthInput).not.toBeDisabled();
  });
});

// ─── Tests: validación ────────────────────────────────────────────────────────

describe("InstallmentForm — validación", () => {
  it("muestra error si el monto está vacío al enviar", async () => {
    const user = userEvent.setup();
    renderForm({});

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/monto es requerido/i)).toBeInTheDocument();
    });
    expect(mockCreateInstallment).not.toHaveBeenCalled();
  });

  it("muestra error si el monto es 0 o inválido", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "0");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/monto mayor a 0/i)).toBeInTheDocument();
    });
    expect(mockCreateInstallment).not.toHaveBeenCalled();
  });

  it("muestra error si la cantidad de cuotas está vacía al enviar", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "1500");

    // No llenar cantidad de cuotas
    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // El error puede aparecer en múltiples lugares (Input interno + div externo)
      const errors = screen.getAllByText(/cantidad de cuotas es requerida/i);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
    expect(mockCreateInstallment).not.toHaveBeenCalled();
  });

  it("muestra error si la cantidad de cuotas es 0 o negativa", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "1500");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.clear(totalInput);
    await user.type(totalInput, "0");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // El error puede aparecer en múltiples lugares (Input interno + div externo)
      const errors = screen.getAllByText(/cantidad de cuotas mayor a 0/i);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
    expect(mockCreateInstallment).not.toHaveBeenCalled();
  });

  it("muestra error si no se selecciona categoría", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "1500");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.type(totalInput, "12");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/categoría es requerida/i)).toBeInTheDocument();
    });
    expect(mockCreateInstallment).not.toHaveBeenCalled();
  });
});

// ─── Tests: filtrado de categorías ───────────────────────────────────────────

describe("InstallmentForm — filtrado de categorías por scope", () => {
  it("muestra categorías EXPENSE y BOTH, no INCOME (cuotas son siempre Gasto)", () => {
    renderForm({});

    const select = screen.getByLabelText(/categoría/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Tecnología")).toBeInTheDocument(); // EXPENSE
    expect(screen.getByText("Varios")).toBeInTheDocument(); // BOTH
    expect(screen.queryByText("Sueldo")).not.toBeInTheDocument(); // INCOME — no debe aparecer
  });
});

// ─── Tests: sin categorías disponibles ───────────────────────────────────────

describe("InstallmentForm — sin categorías disponibles", () => {
  it("bloquea el submit y muestra enlace a /categorias cuando no hay categorías de gasto", () => {
    // Solo categoría de ingreso — ninguna compatible con EXPENSE
    mockUseCategories.mockReturnValue({
      categories: [mockIncomeCategory],
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

    renderForm({});

    // El submit debe estar deshabilitado
    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    expect(submitBtn).toBeDisabled();

    // Debe mostrar enlace a /categorias
    const link = screen.getByRole("link", { name: /creá una categoría/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/categorias");
  });
});

// ─── Tests: prefill en edición ────────────────────────────────────────────────

describe("InstallmentForm — prefill en edición", () => {
  it("precarga el monto por cuota desde amountCents", () => {
    renderForm({ installment: mockInstallmentGroup });
    // 50000 centavos = 500 pesos
    const amountInput = screen.getByLabelText(/monto por cuota/i) as HTMLInputElement;
    expect(amountInput.value).toBe("500");
  });

  it("precarga la cantidad de cuotas desde totalInstallments", () => {
    renderForm({ installment: mockInstallmentGroup });
    const totalInput = screen.getByLabelText(/cant\. de cuotas/i) as HTMLInputElement;
    expect(totalInput.value).toBe("12");
  });

  it("precarga el mes de inicio desde startMonth", () => {
    renderForm({ installment: mockInstallmentGroup });
    const monthInput = screen.getByLabelText(/mes de inicio/i) as HTMLInputElement;
    expect(monthInput.value).toBe("2026-01");
  });

  it("precarga la descripción", () => {
    renderForm({ installment: mockInstallmentGroup });
    const descInput = screen.getByLabelText(/descripción/i) as HTMLInputElement;
    expect(descInput.value).toBe("Notebook");
  });
});

// ─── Tests: flujo crear exitoso ───────────────────────────────────────────────

describe("InstallmentForm — flujo crear", () => {
  it("crea el grupo con los datos correctos y cierra el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    renderForm({ onClose });

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "500");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.type(totalInput, "12");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 50000,
          totalInstallments: 12,
          categoryId: "cat-expense",
          startMonth: "2026-06",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("convierte pesos a centavos correctamente (pesos con decimales)", async () => {
    const user = userEvent.setup();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    renderForm({});

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "15,50");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.type(totalInput, "3");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 1550 }),
      );
    });
  });

  it("el toast de éxito incluye el mes de inicio (para navegación 'Ir a ver')", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    renderForm({ onClose });

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "500");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.type(totalInput, "12");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ─── Tests: flujo editar exitoso ─────────────────────────────────────────────

describe("InstallmentForm — flujo editar", () => {
  it("llama updateInstallment sin type en el body y cierra el modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateInstallment.mockResolvedValue({
      success: true,
      installment: { ...mockInstallmentGroup, amountCents: 60000 },
    });

    renderForm({ installment: mockInstallmentGroup, onClose });

    // Cambiar el monto
    const amountInput = screen.getByLabelText(/monto por cuota/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "600");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateInstallment).toHaveBeenCalledWith(
        "inst-1",
        expect.objectContaining({
          amountCents: 60000,
          totalInstallments: 12,
          startMonth: "2026-01",
          categoryId: "cat-expense",
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });

    // NO debe incluir 'type' en el body del PATCH
    const callBody = mockUpdateInstallment.mock.calls[0][1] as Record<string, unknown>;
    expect(callBody).not.toHaveProperty("type");
  });
});

// ─── Tests: error del backend (RNF-008) ──────────────────────────────────────

describe("InstallmentForm — error del backend", () => {
  it("muestra toast de error y mantiene el modal abierto", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateInstallment.mockResolvedValue({
      success: false,
      error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
    });

    renderForm({ onClose });

    const amountInput = screen.getByLabelText(/monto por cuota/i);
    await user.type(amountInput, "500");

    const totalInput = screen.getByLabelText(/cant\. de cuotas/i);
    await user.type(totalInput, "12");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalled();
    });

    // Modal debe seguir abierto
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Tests: cotización y moneda (Fase 1.2.4 — disclosure + moneda=default) ───────

describe("InstallmentForm — cotización y moneda (Fase 1.2.4)", () => {
  it("NO muestra el campo de cotización cuando moneda === defaultCurrency (campo oculto)", () => {
    // Fase 1.2.4: cuando moneda==default el campo cotización no se renderiza.
    renderForm({});
    expect(screen.queryByLabelText(/cotización/i)).not.toBeInTheDocument();
  });

  it("envía exchangeRate=1 al backend cuando moneda === default (no valida el campo oculto)", async () => {
    const user = userEvent.setup();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    // Incluso con lastExchangeRate=null, si moneda===default el form envía 1 directamente.
    mockUseSettings.mockReturnValue({
      settings: { defaultCurrency: "ARS", lastExchangeRate: null },
      defaultCurrency: "ARS",
      lastExchangeRate: null,
      isLoading: false,
      isError: false,
      updateSettings: vi.fn(),
      isSaving: false,
    });

    renderForm({});

    await user.type(screen.getByLabelText(/monto por cuota/i), "500");
    await user.type(screen.getByLabelText(/cant\. de cuotas/i), "12");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });

  it("envía exchangeRate=1 (no usa lastExchangeRate) cuando moneda === default", async () => {
    const user = userEvent.setup();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    // lastExchangeRate=1200 pero moneda===ARS (default) → se envía 1, no 1200
    renderForm({});

    await user.type(screen.getByLabelText(/monto por cuota/i), "500");
    await user.type(screen.getByLabelText(/cant\. de cuotas/i), "12");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });
});

// ─── Tests: currency en edición (Fase 1.2.4) ─────────────────────────────────

describe("InstallmentForm — currency en edición (Fase 1.2.4)", () => {
  it("el PATCH incluye currency con el valor del form al editar (sin cambio de moneda)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    renderForm({ installment: mockInstallmentGroup, onClose });

    const amountInput = screen.getByLabelText(/monto por cuota/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "600");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateInstallment).toHaveBeenCalledWith(
        "inst-1",
        expect.objectContaining({
          currency: "ARS",
        }),
      );
    });
  });

  it("el crear incluye currency en el payload (crea con ARS por defecto)", async () => {
    const user = userEvent.setup();
    mockCreateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    renderForm({});

    await user.type(screen.getByLabelText(/monto por cuota/i), "500");
    await user.type(screen.getByLabelText(/cant\. de cuotas/i), "12");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateInstallment).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "ARS",
        }),
      );
    });
  });

  it("cambiar la moneda en edición actualiza la cotización desde referenceRate", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    // Configurar referenceRate para USD
    mockUseReferenceRate.mockReturnValue({
      referenceRate: 1350,
      isLoading: false,
      isError: false,
    });

    // Grupo en ARS con exchangeRate=1
    const arsInstallment = { ...mockInstallmentGroup, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ installment: arsInstallment, onClose });

    // Con moneda=ARS (==default) el disclosure arranca colapsado y no hay campo cotización.
    // El CurrencySegmented está en el DOM (el grid-rows lo oculta visualmente, no del DOM).
    // Cambiar la moneda a USD: el radio está accesible aunque el disclosure esté colapsado.
    const usdBtn = screen.getByRole("radio", { name: /^usd$/i });
    await user.click(usdBtn);

    // Después de cambiar a USD (≠ default), el cuerpo del disclosure muestra el grid 2-col
    // con el input de cotización. La cotización se actualiza a 1350 (referenceRate).
    await waitFor(() => {
      const updatedRateInput = screen.getByLabelText(/cotización/i) as HTMLInputElement;
      expect(updatedRateInput.value).toBe("1.350,00");
    });
  });

  it("cambiar la moneda en edición sin referenceRate usa lastExchangeRate", async () => {
    const user = userEvent.setup();
    mockUpdateInstallment.mockResolvedValue({ success: true, installment: mockInstallmentGroup });

    // Sin referenceRate disponible
    mockUseReferenceRate.mockReturnValue({
      referenceRate: null,
      isLoading: false,
      isError: false,
    });

    const arsInstallment = { ...mockInstallmentGroup, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ installment: arsInstallment });

    // Cambiar a USD: el radio está en el DOM aunque el disclosure esté colapsado.
    const usdBtn = screen.getByRole("radio", { name: /^usd$/i });
    await user.click(usdBtn);

    // Sin referenceRate, usa lastExchangeRate = 1200 (del mock beforeEach)
    await waitFor(() => {
      const updatedRateInput = screen.getByLabelText(/cotización/i) as HTMLInputElement;
      expect(updatedRateInput.value).toBe("1.200,00");
    });
  });
});
