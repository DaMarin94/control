/**
 * Tests de CaptureShell — envase de la superficie de captura (RF-APP-003,
 * docs/design.md §Superficie de captura). Smoke test de la
 * anatomía del envase: cabecera (identidad + tabs), un único botón de
 * acción (sin "Cancelar" — no hay a dónde volver) y título accesible.
 *
 * Mocks: los mismos hooks que transaction-form.test.tsx (el tab activo por
 * default es "Único" → monta TransactionForm).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptureShell } from "@/components/capture/capture-shell";
import { ToastProvider } from "@/components/ui/toast";
import type { Category } from "@/types/category";

// ─── Mocks (mismos que transaction-form.test.tsx) ──────────────────────────

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: vi.fn(),
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

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";

const mockUseCategories = vi.mocked(useCategories);
const mockUseTransactions = vi.mocked(useTransactions);

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

function renderShell() {
  return render(
    <ToastProvider>
      <CaptureShell email="usuario@control.com" />
    </ToastProvider>,
  );
}

describe("CaptureShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategories.mockReturnValue({
      categories: [mockExpenseCategory],
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
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      skipTransaction: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isSkipping: false,
    });
  });

  it("muestra el email de la cuenta activa en la cabecera", () => {
    renderShell();
    expect(screen.getByText("usuario@control.com")).toBeInTheDocument();
  });

  it("muestra las tres tabs Único / Fijo / Cuotas, con Único activo", () => {
    renderShell();
    expect(screen.getByRole("tab", { name: "Único" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Fijo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cuotas" })).toBeInTheDocument();
  });

  it("declara un <h1> accesible 'Nuevo movimiento' (sin título visible en pantalla)", () => {
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Nuevo movimiento" })).toBeInTheDocument();
  });

  it("el footer tiene UN SOLO botón de acción (Guardar) — sin 'Cancelar'", () => {
    renderShell();
    expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
  });

  it("el botón Guardar se deshabilita cuando no hay categorías para el tipo elegido", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
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
    renderShell();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeDisabled();
  });

  it("sin categorías: el aviso NO ofrece el enlace a Configuración → Categorías (salida de callejón, §11)", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
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
    renderShell();
    expect(screen.getByText(/sin categorías para este tipo/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /creá una categoría/i })).not.toBeInTheDocument();
  });
});
