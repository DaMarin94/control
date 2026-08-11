/**
 * Regresión del gotcha "editar y después borrar el mismo movimiento deja dos
 * toasts en vez de reemplazarse" (Fase 1.2.5).
 *
 * Causa raíz: el `groupId` del toast "Deshacer" de EDICIÓN no coincidía con el
 * de BORRADO del mismo movimiento (invariante RN-024: ambos toasts DEBEN
 * compartir groupId, o el segundo no reemplaza al primero). Estos tests
 * reproducen el flujo real (editar →
 * cerrar el form → abrir el diálogo de borrado → confirmar), ambos montados
 * bajo el MISMO `<ToastProvider>` (como en month-view-client.tsx), y verifican
 * que el toast de borrado REEMPLAZA al de edición — nunca hay 2 toasts.
 *
 * Casos cubiertos:
 * - Fijo normal: RecurringForm (edición) → DeleteRecurringDialog (variant="fijo").
 * - Calculado de fijo: CalculatedForm (edición, sourceType="fijo") →
 *   DeleteRecurringDialog (variant="fijo") — el id de fila puede cambiar por
 *   split, así que la clave tiene que ser el chainId en ambos caminos.
 * - Calculado de único: CalculatedForm (edición, sourceType="unico") →
 *   DeleteRecurringDialog (variant="calculated-simple") — edita siempre
 *   in-place (sin split), así que la clave es el id de fila en ambos caminos.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringForm } from "@/components/movements/recurring-form";
import { CalculatedForm } from "@/components/movements/calculated-form";
import { DeleteRecurringDialog } from "@/components/movements/delete-recurring-dialog";
import { ToastProvider } from "@/components/ui/toast";
import type { Recurring } from "@/types/recurring";
import type { MovementItem } from "@/types/movement";
import type { Category } from "@/types/category";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ─── Mocks compartidos ────────────────────────────────────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

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

vi.mock("@/hooks/use-calculated", () => ({
  useCalculated: vi.fn(),
}));

vi.mock("@/hooks/use-history", () => ({
  useUndoHistory: vi.fn(() => ({ undo: vi.fn(), isUndoing: false })),
}));

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

vi.mock("@/app/(app)/configuracion/categorias/category-form-modal", () => ({
  CategoryFormModal: vi.fn(() => null),
}));

import { useCategories } from "@/hooks/use-categories";
import { useRecurring } from "@/hooks/use-recurring";
import { useCalculated } from "@/hooks/use-calculated";

const mockUseCategories = vi.mocked(useCategories);
const mockUseRecurring = vi.mocked(useRecurring);
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

/** Fijo normal — chainId estable (misma cadena antes/después del split de edición) */
const mockRecurring: Recurring = {
  id: "rec-1",
  chainId: "chain-fijo-1",
  userId: "user-1",
  categoryId: "cat-expense",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  startMonth: "2026-01",
  deletedFrom: null,
  frequency: 1,
  currency: "ARS",
  exchangeRate: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
  paymentMethodId: null,
  paymentMethod: null,
  autoDebit: null,
};

/** El mismo fijo, tal como aparece en la Vista del mes (ítem del listado) */
const mockFijoMovement: MovementItem = {
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
  chainId: "chain-fijo-1",
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
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

/** Calculado de fijo — chainId propio (distinto del sourceChainId del origen) */
const mockCalculadoFijoMovement: MovementItem = {
  id: "calc-fijo-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: -15000,
  description: "IVA del alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2026-01",
  endMonth: null,
  chainId: "chain-calc-fijo-1",
  skipped: false,
  category: { id: "cat-expense", name: "Servicios", color: "#FF5733", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: {
    sourceType: "fijo",
    sourceId: "rec-1",
    sourceChainId: "chain-fijo-1",
    sourceDescription: "Alquiler",
    formulaOperator: "PCT",
    formulaOperand: 1000,
    formulaSign: -1,
    sourceAmountCents: 150000,
  },
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: -15000,
  calculatedChildren: [],
  simulated: false,
};

/** Calculado de único — sin chainId propio en el ítem; edita siempre in-place */
const mockCalculadoUnicoMovement: MovementItem = {
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
    sourceId: "trans-origen",
    sourceChainId: null,
    sourceDescription: "Compra",
    formulaOperator: "PCT",
    formulaOperand: 1000,
    formulaSign: 1,
    sourceAmountCents: 50000,
  },
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 5000,
  calculatedChildren: [],
  simulated: false,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockUpdateRecurring = vi.fn();
const mockDeleteRecurring = vi.fn();
const mockUpdateCalculated = vi.fn();
const mockCreateCalculated = vi.fn();

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

beforeEach(() => {
  vi.clearAllMocks();

  mockUseCategories.mockReturnValue({
    categories: [mockExpenseCategory, mockIncomeCategory],
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
    createRecurring: vi.fn(),
    updateRecurring: mockUpdateRecurring,
    deleteRecurring: mockDeleteRecurring,
    skipRecurring: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });

  mockUseCalculated.mockReturnValue({
    createCalculated: mockCreateCalculated,
    updateCalculated: mockUpdateCalculated,
    isCreating: false,
    isUpdating: false,
  });
});

// ─── Caso 1: fijo normal ──────────────────────────────────────────────────────

/**
 * Orquesta el flujo real: RecurringForm (edición) montado primero; al cerrar
 * (onClose), se desmonta y se monta DeleteRecurringDialog — ambos bajo el
 * MISMO ToastProvider, igual que month-view-client.tsx.
 */
function EditThenDeleteFijo() {
  const [step, setStep] = useState<"edit" | "delete" | "done">("edit");
  if (step === "edit") {
    return (
      <RecurringForm
        recurring={mockRecurring}
        onClose={() => setStep("delete")}
        viewMonth="2026-06"
      />
    );
  }
  if (step === "delete") {
    return (
      <DeleteRecurringDialog
        movement={mockFijoMovement}
        onClose={() => setStep("done")}
        viewMonth="2026-06"
      />
    );
  }
  return null;
}

describe("Toast Deshacer — groupId por forma de movimiento (regresión del gotcha)", () => {
  it("fijo: editar y después borrar el mismo movimiento deja UN solo toast (reemplaza, no apila)", async () => {
    const user = userEvent.setup();
    mockUpdateRecurring.mockResolvedValue({
      success: true,
      recurring: { ...mockRecurring, amountCents: 200000 },
      historyEntryId: "hist-edit-1",
    });
    mockDeleteRecurring.mockResolvedValue({
      success: true,
      historyEntryId: "hist-delete-1",
    });

    render(<EditThenDeleteFijo />, { wrapper: createWrapper() });

    // 1) Editar: submit sin cambiar nada (los valores están precargados)
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => {
      expect(screen.getByText(/^actualizado:/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    // 2) Borrar el MISMO movimiento (el diálogo ya está montado tras onClose)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/^eliminado:/i)).toBeInTheDocument();
    });
    // El toast de borrado REEMPLAZÓ al de edición — nunca hubo 2 simultáneos.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/^actualizado:/i)).not.toBeInTheDocument();
  });
});

// ─── Caso 2: calculado de fijo (puede splitear al editar) ────────────────────

function EditThenDeleteCalculadoFijo() {
  const [step, setStep] = useState<"edit" | "delete" | "done">("edit");
  if (step === "edit") {
    return (
      <CalculatedForm
        mode="edit"
        movement={mockCalculadoFijoMovement}
        onClose={() => setStep("delete")}
        viewMonth="2026-06"
      />
    );
  }
  if (step === "delete") {
    return (
      <DeleteRecurringDialog
        movement={mockCalculadoFijoMovement}
        onClose={() => setStep("done")}
        viewMonth="2026-06"
      />
    );
  }
  return null;
}

describe("Toast Deshacer — calculado de fijo (id de fila inestable por split)", () => {
  it("editar y después borrar el mismo calculado deja UN solo toast", async () => {
    const user = userEvent.setup();
    mockUpdateCalculated.mockResolvedValue({
      success: true,
      id: "calc-fijo-1-v2", // simula el nuevo id de fila tras un split
      chainId: "chain-calc-fijo-1", // el chainId NUNCA cambia
      historyEntryId: "hist-edit-2",
    });
    mockDeleteRecurring.mockResolvedValue({
      success: true,
      historyEntryId: "hist-delete-2",
    });

    render(<EditThenDeleteCalculadoFijo />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => {
      expect(screen.getByText(/^actualizado:/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/^eliminado:/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/^actualizado:/i)).not.toBeInTheDocument();
  });
});

// ─── Caso 3: calculado de único (edita siempre in-place, sin split) ──────────

function EditThenDeleteCalculadoUnico() {
  const [step, setStep] = useState<"edit" | "delete" | "done">("edit");
  if (step === "edit") {
    return (
      <CalculatedForm
        mode="edit"
        movement={mockCalculadoUnicoMovement}
        onClose={() => setStep("delete")}
        viewMonth="2026-06"
      />
    );
  }
  if (step === "delete") {
    return (
      <DeleteRecurringDialog
        movement={mockCalculadoUnicoMovement}
        onClose={() => setStep("done")}
        viewMonth="2026-06"
        variant="calculated-simple"
      />
    );
  }
  return null;
}

describe("Toast Deshacer — calculado de único (id de fila estable, sin split)", () => {
  it("editar y después borrar el mismo calculado deja UN solo toast", async () => {
    const user = userEvent.setup();
    mockUpdateCalculated.mockResolvedValue({
      success: true,
      id: "calc-unico-1",
      chainId: "chain-recurring-row-calc-unico-1", // chainId de la fila Recurring — distinto del id
      historyEntryId: "hist-edit-3",
    });
    mockDeleteRecurring.mockResolvedValue({
      success: true,
      historyEntryId: "hist-delete-3",
    });

    render(<EditThenDeleteCalculadoUnico />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => {
      expect(screen.getByText(/^actualizado:/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/^eliminado:/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/^actualizado:/i)).not.toBeInTheDocument();
  });
});
