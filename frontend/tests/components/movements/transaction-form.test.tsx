/**
 * Tests del formulario de movimiento único.
 * Verifica: validación del form (monto > 0, categoría requerida),
 * filtrado de categorías por scope, conversión pesos→centavos,
 * conversión fecha/hora local→UTC, flujo crear exitoso con toast "Ir a ver",
 * modo edición con campos precargados, manejo de error del backend.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm } from "@/components/movements/transaction-form";
import { ToastProvider } from "@/components/ui/toast";
import type { Transaction } from "@/types/transaction";
import type { Category } from "@/types/category";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: vi.fn(),
}));

// Mock de use-settings — defaultCurrency ARS, lastExchangeRate pre-cargado para que
// el campo cotización arranque con un valor válido en los tests de flujo crear.
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

// Mockear format para controlar la zona horaria en tests
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getBrowserTimezone: vi.fn(() => "America/Argentina/Buenos_Aires"),
  };
});

import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useRouter } from "next/navigation";

const mockUseCategories = vi.mocked(useCategories);
const mockUseTransactions = vi.mocked(useTransactions);
const mockUseSettings = vi.mocked(useSettings);
const mockUseReferenceRate = vi.mocked(useReferenceRate);
const mockUseRouter = vi.mocked(useRouter);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockExpenseCategory: Category = {
  id: "cat-expense",
  userId: "user-1",
  name: "Alimentación",
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
  name: "Salario",
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

const mockTransaction: Transaction = {
  id: "tx-1",
  userId: "user-1",
  categoryId: "cat-expense",
  type: "EXPENSE",
  amountCents: 1550,
  description: "Almuerzo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  currency: "ARS",
  exchangeRate: 1,
  createdAt: "2026-06-17T17:30:00.000Z",
  updatedAt: "2026-06-17T17:30:00.000Z",
  category: {
    id: "cat-expense",
    name: "Alimentación",
    color: "#FF5733",
    scope: "EXPENSE",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(props: { transaction?: Transaction | null; onClose?: () => void }) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <TransactionForm transaction={props.transaction ?? null} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockCreateTransaction = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();
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

  mockUseTransactions.mockReturnValue({
    createTransaction: mockCreateTransaction,
    updateTransaction: mockUpdateTransaction,
    deleteTransaction: mockDeleteTransaction,
    skipTransaction: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });

  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
});

// ─── Tests: validación del formulario ─────────────────────────────────────────

describe("TransactionForm — validación", () => {
  it("muestra error si el monto está vacío al enviar", async () => {
    const user = userEvent.setup();
    renderForm({});

    // Limpiar el campo de monto y enviar
    const amountInput = screen.getByLabelText(/monto/i);
    await user.clear(amountInput);
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/el monto es requerido/i)).toBeInTheDocument();
    });

    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });

  it("muestra error si el monto es 0 o negativo", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.clear(amountInput);
    await user.type(amountInput, "0");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/monto mayor a 0/i)).toBeInTheDocument();
    });
  });

  it("muestra error si no se seleccionó categoría", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "100");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/la categoría es requerida/i)).toBeInTheDocument();
    });

    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });

  it("acepta monto con coma como separador decimal ('15,50')", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "15,50");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 1550 }),
      );
    });
  });
});

// ─── Tests: filtrado de categorías por scope (RN-010) ─────────────────────────

describe("TransactionForm — filtrado de categorías por scope", () => {
  it("para tipo EXPENSE muestra solo categorías EXPENSE y BOTH", () => {
    renderForm({});

    // Por defecto el tipo es EXPENSE
    expect(screen.getByText("Alimentación")).toBeInTheDocument(); // scope EXPENSE
    expect(screen.getByText("Varios")).toBeInTheDocument(); // scope BOTH
    expect(screen.queryByText("Salario")).not.toBeInTheDocument(); // scope INCOME — no debe aparecer
  });

  it("para tipo INCOME muestra solo categorías INCOME y BOTH", async () => {
    const user = userEvent.setup();
    renderForm({});

    // Cambiar el tipo a INCOME clickando el botón toggle
    const ingresoBtn = screen.getByRole("button", { name: /^ingreso$/i });
    await user.click(ingresoBtn);

    await waitFor(() => {
      expect(screen.getByText("Salario")).toBeInTheDocument(); // scope INCOME
      expect(screen.getByText("Varios")).toBeInTheDocument(); // scope BOTH
      expect(screen.queryByText("Alimentación")).not.toBeInTheDocument(); // scope EXPENSE — no debe aparecer
    });
  });

  it("muestra aviso y bloquea guardado cuando no hay categorías disponibles", () => {
    mockUseCategories.mockReturnValue({
      categories: [mockIncomeCategory], // Solo categoría de ingreso
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

    renderForm({}); // Tipo EXPENSE por defecto, ninguna categoría EXPENSE disponible

    expect(screen.getByText(/sin categorías para este tipo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeDisabled();
  });
});

// ─── Tests: flujo crear exitoso ────────────────────────────────────────────────

describe("TransactionForm — flujo crear", () => {
  it("llama a createTransaction con los datos correctos (amountCents en centavos)", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    const onClose = vi.fn();
    renderForm({ onClose });

    await user.type(screen.getByLabelText(/monto/i), "15.50");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 1550,
          categoryId: "cat-expense",
        }),
      );
    });
  });

  it("la llamada incluye occurredAt (ISO UTC) y timezone (IANA)", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: "America/Argentina/Buenos_Aires",
          occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        }),
      );
    });
  });

  it("cierra el modal y muestra toast con acción 'Ir a ver' al guardar exitosamente", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    const onClose = vi.fn();
    renderForm({ onClose });

    await user.type(screen.getByLabelText(/monto/i), "15.50");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(screen.getByText(/movimiento guardado correctamente/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ir a ver/i })).toBeInTheDocument();
    });
  });

  it("el botón 'Ir a ver' navega a /mes?month=YYYY-MM del mes del movimiento", async () => {
    const user = userEvent.setup();
    // Usar una fecha fija para el movimiento
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: {
        ...mockTransaction,
        occurredAt: "2026-06-17T17:30:00.000Z",
      },
    });

    renderForm({});

    // Usar fecha fija
    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-06-17" } });
    const timeInput = screen.getByLabelText(/hora/i);
    fireEvent.change(timeInput, { target: { value: "14:30" } });

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ir a ver/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ir a ver/i }));

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/mes\?month=\d{4}-\d{2}/));
  });

  it("mantiene el modal abierto y muestra toast de error si el backend falla (RNF-008)", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: false,
      error: "Error del servidor",
    });

    const onClose = vi.fn();
    renderForm({ onClose });

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/error del servidor/i)).toBeInTheDocument();
    });

    // El modal NO debe cerrarse
    expect(onClose).not.toHaveBeenCalled();
    // Los datos deben conservarse
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });
});

// ─── Tests: creación inline de categoría (RF-MU-004) ──────────────────────────

describe("TransactionForm — '+ Nueva' categoría inline", () => {
  it("el botón '+ Nueva' abre el modal de nueva categoría", async () => {
    const user = userEvent.setup();
    renderForm({});

    await user.click(screen.getByRole("button", { name: /\+ nueva/i }));

    // El modal de categoría se abre en modo crear
    expect(screen.getByText(/nueva categoría/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear categoría/i })).toBeInTheDocument();
  });

  it("el modal inline restringe el scope al tipo EXPENSE del movimiento (oculta INCOME)", async () => {
    const user = userEvent.setup();
    renderForm({}); // Tipo EXPENSE por defecto

    await user.click(screen.getByRole("button", { name: /\+ nueva/i }));

    // El modal de categoría usa el scope picker (botones) con label "Alcance"
    // Cuando lockScopeToType="EXPENSE", el botón "Ingreso" no debe aparecer
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /^ingreso$/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^gasto$/i })).toBeInTheDocument();
  });
});

// ─── Tests: modo edición ───────────────────────────────────────────────────────

describe("TransactionForm — modo edición", () => {
  it("precarga los campos con los datos de la transacción existente", () => {
    renderForm({ transaction: mockTransaction });

    // El monto debe mostrarse en pesos
    expect(screen.getByDisplayValue("15,5")).toBeInTheDocument(); // 1550 centavos = 15.5

    // El botón debe decir "Guardar cambios"
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it("llama a updateTransaction con los datos correctos al guardar", async () => {
    const user = userEvent.setup();
    mockUpdateTransaction.mockResolvedValue({
      success: true,
      transaction: { ...mockTransaction, amountCents: 2000 },
    });

    const onClose = vi.fn();
    renderForm({ transaction: mockTransaction, onClose });

    const amountInput = screen.getByDisplayValue("15,5");
    await user.clear(amountInput);
    await user.type(amountInput, "20.00");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalledWith(
        "tx-1",
        expect.objectContaining({ amountCents: 2000 }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("no muestra tabs en modo edición", () => {
    // Los tabs solo deben aparecer en el TransactionModal, no en el form directamente.
    // Este test verifica que el form no renderiza tabs.
    renderForm({ transaction: mockTransaction });

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});

// ─── Tests: cotización y moneda (Fase 1.2.4 — disclosure + moneda=default) ───────

describe("TransactionForm — cotización y moneda (Fase 1.2.4)", () => {
  it("NO muestra el campo de cotización cuando moneda === defaultCurrency (campo oculto)", () => {
    // Fase 1.2.4: cuando moneda==default el campo cotización no se renderiza.
    renderForm({});
    // El disclosure arranca colapsado: no hay textbox de cotización en el DOM.
    expect(screen.queryByLabelText(/cotización/i)).not.toBeInTheDocument();
  });

  it("envía exchangeRate=1 al backend cuando moneda === default (no valida el campo oculto)", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

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

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });

  it("envía exchangeRate=1 (no usa lastExchangeRate) cuando moneda === default", async () => {
    const user = userEvent.setup();
    mockCreateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    // lastExchangeRate=1200 pero moneda===ARS (default) → se envía 1, no 1200
    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });
});

// ─── Tests: currency en edición (Fase 1.2.4) ─────────────────────────────────

describe("TransactionForm — currency en edición (Fase 1.2.4)", () => {
  it("el PUT incluye currency con el valor del form al editar (sin cambio de moneda)", async () => {
    const user = userEvent.setup();
    mockUpdateTransaction.mockResolvedValue({
      success: true,
      transaction: { ...mockTransaction, amountCents: 2000 },
    });

    const onClose = vi.fn();
    renderForm({ transaction: mockTransaction, onClose });

    const amountInput = screen.getByDisplayValue("15,5");
    await user.clear(amountInput);
    await user.type(amountInput, "20.00");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalledWith(
        "tx-1",
        expect.objectContaining({
          currency: "ARS",
        }),
      );
    });
  });

  it("cambiar la moneda en edición actualiza la cotización desde referenceRate", async () => {
    const user = userEvent.setup();
    mockUpdateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    // Configurar referenceRate para USD
    mockUseReferenceRate.mockReturnValue({
      referenceRate: 1350,
      isLoading: false,
      isError: false,
    });

    // Transacción en ARS con exchangeRate=1
    const arsTx = { ...mockTransaction, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ transaction: arsTx });

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
    mockUpdateTransaction.mockResolvedValue({
      success: true,
      transaction: mockTransaction,
    });

    // Sin referenceRate disponible
    mockUseReferenceRate.mockReturnValue({
      referenceRate: null,
      isLoading: false,
      isError: false,
    });

    const arsTx = { ...mockTransaction, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ transaction: arsTx });

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
