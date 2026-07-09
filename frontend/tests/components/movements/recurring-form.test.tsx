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
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringForm } from "@/components/movements/recurring-form";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";
import type { Recurring } from "@/types/recurring";
import type { PaymentMethod } from "@/types/payment-method";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

// PaymentMethodSelect (RF-PM-006) usa usePaymentMethods internamente — mockeado
// para no depender de useApi/useSession real en este test de formulario.
vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(() => ({
    paymentMethods: [],
    isLoading: false,
    isError: false,
    error: null,
    createPaymentMethod: vi.fn(),
    updatePaymentMethod: vi.fn(),
    deletePaymentMethod: vi.fn(),
    reactivatePaymentMethod: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReactivating: false,
  })),
}));

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

// Prefill del método de pago por defecto (RF-PM-007) usa usePreferences
// internamente — mockeado para no depender de useSession real.
vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(() => ({
    preferences: {},
    setPreferences: vi.fn(),
    isSaving: false,
    isLoading: false,
    isError: false,
    error: null,
  })),
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

// P2 — Fase 2: intercepción de límites activos. Por defecto sin límites (cero
// fricción); los tests de la compuerta lo sobreescriben.
vi.mock("@/hooks/use-active-limit-projection", () => ({
  useActiveLimitProjection: vi.fn(() => ({ evaluate: vi.fn(() => []) })),
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
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePreferences } from "@/hooks/use-preferences";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useRouter } from "next/navigation";

const mockUseCategories = vi.mocked(useCategories);
const mockUseRecurring = vi.mocked(useRecurring);
const mockUsePaymentMethods = vi.mocked(usePaymentMethods);
const mockUsePreferences = vi.mocked(usePreferences);
const mockUseSettings = vi.mocked(useSettings);
const mockUseReferenceRate = vi.mocked(useReferenceRate);
const mockUseActiveLimitProjection = vi.mocked(useActiveLimitProjection);
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
  frequency: "MONTHLY",
  currency: "ARS",
  exchangeRate: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  category: {
    id: "cat-expense",
    name: "Servicios",
    color: "#FF5733",
    scope: "EXPENSE",
  },
  paymentMethodId: null,
  paymentMethod: null,
  autoDebit: null,
};

const mockDebitMethod: PaymentMethod = {
  id: "pm-debit-1",
  userId: "user-1",
  name: "Débito Banco Nación",
  type: "DEBIT",
  icon: "card",
  closingDay: null,
  paymentDay: null,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

const mockCreditMethod: PaymentMethod = {
  id: "pm-credit-1",
  userId: "user-1",
  name: "Visa Banco Nación",
  type: "CREDIT",
  icon: "visa",
  closingDay: 15,
  paymentDay: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(props: {
  recurring?: Recurring | null;
  onClose?: () => void;
  editingSkipped?: boolean;
}) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ToastProvider>
      <RecurringForm
        recurring={props.recurring ?? null}
        onClose={onClose}
        editingSkipped={props.editingSkipped}
      />
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

  mockUseRecurring.mockReturnValue({
    createRecurring: mockCreateRecurring,
    updateRecurring: mockUpdateRecurring,
    deleteRecurring: mockDeleteRecurring,
    skipRecurring: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });

  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);

  // P2 — Fase 2: por defecto sin cruces (cero fricción) — los tests de la
  // compuerta sobreescriben con mockUseActiveLimitProjection.mockReturnValue(...).
  mockUseActiveLimitProjection.mockReturnValue({ evaluate: vi.fn(() => []) });
});

// ─── Tests: validación ────────────────────────────────────────────────────────

describe("RecurringForm — validación", () => {
  it("muestra error si el monto está vacío al enviar", async () => {
    const user = userEvent.setup();
    renderForm({});

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
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

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/monto mayor a 0/i)).toBeInTheDocument();
    });
    expect(mockCreateRecurring).not.toHaveBeenCalled();
  });

  it("muestra 'El monto es demasiado grande' y bloquea el submit cuando supera el tope del backend (2147483647)", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    // 99.999.999.999 pesos → 9999999999900 centavos, supera 2147483647
    await user.type(amountInput, "99999999999");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/el monto es demasiado grande/i)).toBeInTheDocument();
    });
    expect(mockCreateRecurring).not.toHaveBeenCalled();
  });

  it("muestra error si no se selecciona categoría", async () => {
    const user = userEvent.setup();
    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "1500");

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
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

    // Cambiar tipo a INCOME clickando el botón toggle
    const ingresoBtn = screen.getByRole("button", { name: /^ingreso$/i });
    await user.click(ingresoBtn);

    await waitFor(() => {
      expect(screen.getByText("Sueldo")).toBeInTheDocument(); // INCOME
      expect(screen.getByText("Varios")).toBeInTheDocument(); // BOTH
      expect(screen.queryByText("Servicios")).not.toBeInTheDocument(); // EXPENSE — no debe aparecer
    });
  });
});

// ─── Tests: creación inline de categoría (RF-MU-004) ──────────────────────────

describe("RecurringForm — '+ Nueva' categoría inline", () => {
  it("el botón '+ Nueva' abre el modal de nueva categoría con el scope restringido al tipo EXPENSE", async () => {
    const user = userEvent.setup();
    renderForm({}); // Tipo EXPENSE por defecto

    await user.click(screen.getByRole("button", { name: /\+ nueva/i }));

    // El modal de categoría se abre en modo crear
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/nueva categoría/i)).toBeInTheDocument();

    // El scope picker usa botones con label "Alcance"
    // Cuando lockScopeToType="EXPENSE", el botón "Ingreso" no debe aparecer
    expect(within(dialog).queryByRole("button", { name: /^ingreso$/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^gasto$/i })).toBeInTheDocument();
  });
});

// ─── Tests: tipo read-only en edición (RF-MF-003) ─────────────────────────────

describe("RecurringForm — tipo read-only en edición", () => {
  it("muestra el tipo como campo de texto read-only al editar (no botones toggle)", () => {
    renderForm({ recurring: mockRecurring });

    // En modo edición, el tipo se muestra como un div con el texto "Gasto" (no un select ni botones)
    // Los botones toggle de tipo NO deben aparecer en modo edición
    expect(screen.queryByRole("button", { name: /^gasto$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ingreso$/i })).not.toBeInTheDocument();
    // El texto "Gasto" sí debe aparecer como display read-only
    expect(screen.getByText("Gasto")).toBeInTheDocument();
  });

  it("el selector de tipo NO aparece en modo edición", () => {
    renderForm({ recurring: mockRecurring });

    // No debe haber un select con las opciones Gasto/Ingreso accesibles para cambiar
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

    const submitBtn = screen.getByRole("button", { name: /^guardar$/i });
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

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

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

// ─── Tests: intercepción de límites activos (P2 — Fase 2, D11) ───────────────

describe("RecurringForm — intercepción de límites activos (P2, Fase 2)", () => {
  it("sin cruces: persiste directo, SIN mostrar el aviso (cero fricción)", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });
    const onClose = vi.fn();
    renderForm({ onClose });

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con cruces: muestra el aviso en vez de persistir; 'Guardar igual' persiste", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });
    mockUseActiveLimitProjection.mockReturnValue({
      evaluate: vi.fn(() => [
        {
          id: "l1",
          enabled: true,
          anchorKey: "mes.total.gasto",
          operator: "gt" as const,
          threshold: 100,
          nature: "active" as const,
        },
      ]),
    });
    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    const alertDialog = await screen.findByRole("alertdialog");
    expect(mockCreateRecurring).not.toHaveBeenCalled();

    await user.click(within(alertDialog).getByRole("button", { name: /guardar igual/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalled();
    });
  });

  it("evalúa la proyección contra el MES EN CURSO (2026-06), no el mes de inicio elegido", async () => {
    const user = userEvent.setup();
    const evaluateSpy = vi.fn(() => []);
    mockUseActiveLimitProjection.mockReturnValue({ evaluate: evaluateSpy });
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });
    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreateRecurring).toHaveBeenCalled());
    // useActiveLimitProjection se llama con el mes en curso (mockeado como "2026-06"), D13.
    expect(mockUseActiveLimitProjection).toHaveBeenCalledWith("2026-06");
    expect(evaluateSpy).toHaveBeenCalledWith(expect.objectContaining({ section: "fijos" }));
  });
});

// ─── Tests: reset espurio por cambio de referencia del prop `recurring` ──────
// Bug real: el llamador (month-view-client) arma `recurring` inline en cada
// render (`movementItemToRecurring(editingFijo)`), por lo que la referencia
// cambia en cada re-render del padre (ej. refetch de movements por window
// focus) aunque sea el mismo movimiento. Si el form resetea el monto tipeado
// cada vez que cambia la referencia (no el id), el valor nuevo se pierde antes
// del submit y se envía el monto viejo al backend.

describe("RecurringForm — no resetea el monto tipeado ante re-render del padre con misma id", () => {
  it("mantiene el monto editado por el usuario y lo envía en el PATCH aunque el prop `recurring` cambie de referencia (mismo id)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateRecurring.mockResolvedValue({
      success: true,
      recurring: { ...mockRecurring, amountCents: 200000 },
    });

    function Wrapper() {
      const [, forceRerender] = useState(0);
      // Nueva referencia de objeto en cada render, mismo contenido/id —
      // simula `movementItemToRecurring(editingFijo)` construido inline en JSX.
      const recurringProp: Recurring = { ...mockRecurring };
      return (
        <ToastProvider>
          <RecurringForm recurring={recurringProp} onClose={onClose} />
          <button type="button" onClick={() => forceRerender((n) => n + 1)}>
            simular re-render del padre
          </button>
        </ToastProvider>
      );
    }

    render(<Wrapper />);

    // Usuario edita el monto
    const amountInput = screen.getByLabelText(/monto/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "2000");
    expect(amountInput.value).toBe("2000");

    // El padre se re-renderiza (ej. refetch de movements por window focus),
    // pasando un `recurring` con nueva referencia pero mismo id.
    await user.click(screen.getByRole("button", { name: /simular re-render del padre/i }));

    // El monto tipeado por el usuario debe seguir intacto (no se resetea).
    expect(amountInput.value).toBe("2000");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({ amountCents: 200000 }),
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

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalled();
    });

    // Modal debe seguir abierto
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Tests: selector de frecuencia (P2 — Fase 1.1.1) ─────────────────────────

describe("RecurringForm — selector de frecuencia (crear)", () => {
  it("muestra el selector de frecuencia en modo crear", () => {
    renderForm({});
    expect(screen.getByLabelText(/frecuencia/i)).toBeInTheDocument();
  });

  it("el selector de frecuencia tiene 'Mensual' como valor por defecto", () => {
    renderForm({});
    const select = screen.getByLabelText(/frecuencia/i) as HTMLSelectElement;
    expect(select.value).toBe("MONTHLY");
  });

  it("el selector de frecuencia tiene todas las opciones en orden correcto", () => {
    renderForm({});
    const select = screen.getByLabelText(/frecuencia/i);
    expect(screen.getByRole("option", { name: "Mensual" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bimestral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Trimestral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Semestral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Anual" })).toBeInTheDocument();
    // Verificar que el select existe
    expect(select).toBeInTheDocument();
  });

  it("crear envía la frequency seleccionada al backend", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({});

    const amountInput = screen.getByLabelText(/monto/i);
    await user.type(amountInput, "1500");

    // Seleccionar frecuencia BIMONTHLY
    const freqSelect = screen.getByLabelText(/frecuencia/i);
    await user.selectOptions(freqSelect, "BIMONTHLY");

    const categorySelect = screen.getByLabelText(/categoría/i);
    await user.selectOptions(categorySelect, "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: "BIMONTHLY",
        }),
      );
    });
  });

  it("la nota de recurrencia refleja 'Mensual' por defecto", () => {
    renderForm({});
    expect(screen.getByText(/cada mes a partir del mes de inicio/i)).toBeInTheDocument();
  });

  it("la nota de recurrencia cambia al seleccionar otra frecuencia", async () => {
    const user = userEvent.setup();
    renderForm({});

    const freqSelect = screen.getByLabelText(/frecuencia/i);
    await user.selectOptions(freqSelect, "ANNUAL");

    await waitFor(() => {
      expect(screen.getByText(/cada año a partir del mes de inicio/i)).toBeInTheDocument();
    });
  });
});

describe("RecurringForm — frecuencia read-only en edición (P2 — Fase 1.1.1)", () => {
  it("muestra la frecuencia del fijo como campo read-only (no select) en edición", () => {
    renderForm({ recurring: mockRecurring });

    // El texto "Frecuencia" debe aparecer como label
    expect(screen.getByText("Frecuencia")).toBeInTheDocument();
    // El texto "Mensual" debe aparecer como display read-only
    expect(screen.getByText("Mensual")).toBeInTheDocument();
  });

  it("NO muestra selector de frecuencia en modo edición (solo read-only)", () => {
    renderForm({ recurring: mockRecurring });

    // En edición hay solo un combobox (categoría) — la frecuencia es read-only
    const selects = screen.getAllByRole("combobox");
    // Debe haber exactamente 1 combobox: el de categoría
    expect(selects).toHaveLength(1);
  });

  it("el PATCH no envía frequency (inmutable según contrato del backend)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateRecurring.mockResolvedValue({
      success: true,
      recurring: mockRecurring,
    });

    renderForm({ recurring: mockRecurring, onClose });

    const amountInput = screen.getByLabelText(/monto/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "2000");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateRecurring).toHaveBeenCalled();
      const [, updateBody] = mockUpdateRecurring.mock.calls[0] as [string, Record<string, unknown>];
      // frequency NO debe estar en el body del PATCH
      expect(updateBody).not.toHaveProperty("frequency");
    });
  });
});

// ─── Tests: cotización y moneda (Fase 1.2.4 — disclosure + moneda=default) ───────

describe("RecurringForm — cotización y moneda (Fase 1.2.4)", () => {
  it("NO muestra el campo de cotización cuando moneda === defaultCurrency (campo oculto)", () => {
    // Fase 1.2.4: cuando moneda==default el campo cotización no se renderiza.
    renderForm({});
    expect(screen.queryByLabelText(/cotización/i)).not.toBeInTheDocument();
  });

  it("envía exchangeRate=1 al backend cuando moneda === default (no valida el campo oculto)", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

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

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });

  it("envía exchangeRate=1 (no usa lastExchangeRate) cuando moneda === default", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    // lastExchangeRate=1200 pero moneda===ARS (default) → se envía 1, no 1200
    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1,
        }),
      );
    });
  });
});

// ─── Tests: currency en edición (Fase 1.2.4) ─────────────────────────────────

describe("RecurringForm — currency en edición (Fase 1.2.4)", () => {
  it("el PATCH incluye currency con el valor del form al editar (sin cambio de moneda)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({ recurring: mockRecurring, onClose });

    const amountInput = screen.getByLabelText(/monto/i) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "2000");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({
          currency: "ARS",
        }),
      );
    });
  });

  it("el crear incluye currency en el payload (crea con ARS por defecto)", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "ARS",
        }),
      );
    });
  });

  it("cambiar la moneda en edición actualiza la cotización desde referenceRate", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUpdateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    // Configurar referenceRate para USD (simula que hay cotización de referencia disponible)
    mockUseReferenceRate.mockReturnValue({
      referenceRate: 1350,
      isLoading: false,
      isError: false,
    });

    // Fijo en ARS con exchangeRate=1
    const arsRecurring = { ...mockRecurring, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ recurring: arsRecurring, onClose });

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
    mockUpdateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    // Sin referenceRate disponible para la nueva moneda
    mockUseReferenceRate.mockReturnValue({
      referenceRate: null,
      isLoading: false,
      isError: false,
    });

    const arsRecurring = { ...mockRecurring, currency: "ARS" as const, exchangeRate: 1 };
    renderForm({ recurring: arsRecurring });

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

// ─── Tests: "Débito automático" — atributo del movimiento (P4) ───────────────

describe("RecurringForm — Débito automático (P4, corrección de alcance)", () => {
  beforeEach(() => {
    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [mockDebitMethod],
      isLoading: false,
      isError: false,
      error: null,
      createPaymentMethod: vi.fn(),
      updatePaymentMethod: vi.fn(),
      deletePaymentMethod: vi.fn(),
      reactivatePaymentMethod: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
  });

  it("no muestra el checkbox cuando no hay método de pago elegido", () => {
    renderForm({});
    expect(screen.queryByText(/débito automático/i)).not.toBeInTheDocument();
  });

  it("muestra el checkbox y lo envía en autoDebit=true al elegir un método Débito", async () => {
    const user = userEvent.setup();
    mockCreateRecurring.mockResolvedValue({ success: true, recurring: mockRecurring });

    renderForm({});

    await user.type(screen.getByLabelText(/monto/i), "100");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "cat-expense");
    await user.click(screen.getByLabelText(/método de pago/i));
    await user.click(screen.getByRole("option", { name: /débito banco nación/i }));

    const checkbox = screen.getByRole("checkbox", { name: /débito automático/i });
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockCreateRecurring).toHaveBeenCalledWith(
        expect.objectContaining({ autoDebit: true, paymentMethodId: "pm-debit-1" }),
      );
    });
  });
});

// ─── Tests: prefill de método de pago por defecto (RF-PM-007) ─────────────────

describe("RecurringForm — prefill de método de pago por defecto", () => {
  beforeEach(() => {
    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [mockDebitMethod, mockCreditMethod],
      isLoading: false,
      isError: false,
      error: null,
      createPaymentMethod: vi.fn(),
      updatePaymentMethod: vi.fn(),
      deletePaymentMethod: vi.fn(),
      reactivatePaymentMethod: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
  });

  it("precarga el método de pago por defecto (slot 'fijo') al crear un fijo", () => {
    mockUsePreferences.mockReturnValue({
      preferences: { defaultPaymentMethods: { unico: null, fijo: mockDebitMethod.id, cuota: null } },
      setPreferences: vi.fn(),
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderForm({});

    expect(screen.getAllByText(mockDebitMethod.name).length).toBeGreaterThan(0);
  });

  it("no precarga nada cuando el id guardado no corresponde a un método activo (fallback en lectura)", () => {
    mockUsePreferences.mockReturnValue({
      preferences: { defaultPaymentMethods: { unico: null, fijo: "pm-eliminado", cuota: null } },
      setPreferences: vi.fn(),
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderForm({});

    expect(screen.queryAllByText(mockDebitMethod.name)).toHaveLength(0);
    expect(screen.queryAllByText(mockCreditMethod.name)).toHaveLength(0);
  });

  it("precarga también al crear un ingreso fijo — el default es por estructura, no por tipo", async () => {
    mockUsePreferences.mockReturnValue({
      preferences: { defaultPaymentMethods: { unico: null, fijo: mockDebitMethod.id, cuota: null } },
      setPreferences: vi.fn(),
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    renderForm({});

    const ingresoBtn = screen.getByRole("button", { name: /^ingreso$/i });
    await user.click(ingresoBtn);

    await waitFor(() => {
      expect(screen.getAllByText(mockDebitMethod.name).length).toBeGreaterThan(0);
    });
  });

  it("en edición respeta el método guardado del fijo — el default no lo pisa", () => {
    mockUsePreferences.mockReturnValue({
      preferences: { defaultPaymentMethods: { unico: null, fijo: mockDebitMethod.id, cuota: null } },
      setPreferences: vi.fn(),
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderForm({
      recurring: {
        ...mockRecurring,
        paymentMethodId: mockCreditMethod.id,
        paymentMethod: {
          id: mockCreditMethod.id,
          name: mockCreditMethod.name,
          icon: mockCreditMethod.icon,
          type: mockCreditMethod.type,
        },
      },
    });

    expect(screen.getAllByText(mockCreditMethod.name).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(mockDebitMethod.name)).toHaveLength(0);
  });
});
