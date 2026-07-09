/**
 * Tests de PaymentMethodsList — foco en el indicador de solo-lectura "Predeterminado"
 * de la feature "Método de pago predeterminado por estructura"
 * (RF-PM-007; spec visual en docs/design.md).
 *
 * La edición del default migró al modal (PaymentMethodFormModal — ver
 * payment-method-form-modal.test.tsx); la fila es puramente informativa.
 *
 * Verifica:
 * - Cero impacto sin config: sin defaults, la celda no renderiza nada (ni botón,
 *   ni afordancia en hover).
 * - Estado visible (solo lectura): con ≥1 default, se ve la estrella + pill(s)
 *   por estructura, con aria-label/title que enuncia el estado.
 * - No hay ningún control editable en la fila: sin botón "Predeterminar", sin
 *   popover, sin role="checkbox" en la fila.
 * - Una sola pill por estructura en toda la lista.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentMethodsList } from "@/app/(app)/metodos-pago/payment-methods-list";
import { ToastProvider } from "@/components/ui/toast";
import type { PaymentMethod } from "@/types/payment-method";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(),
}));

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePreferences } from "@/hooks/use-preferences";

const mockUsePaymentMethods = vi.mocked(usePaymentMethods);
const mockUsePreferences = vi.mocked(usePreferences);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const methodA: PaymentMethod = {
  id: "pm-a",
  userId: "user-1",
  name: "Visa Banco Nación",
  type: "CREDIT",
  icon: "visa",
  closingDay: 15,
  paymentDay: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 3,
};

const methodB: PaymentMethod = {
  id: "pm-b",
  userId: "user-1",
  name: "Efectivo",
  type: "CASH",
  icon: "cash",
  closingDay: null,
  paymentDay: null,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderList() {
  return render(
    <ToastProvider>
      <PaymentMethodsList />
    </ToastProvider>,
  );
}

function mockPreferences(preferences: UserPreferences) {
  mockUsePreferences.mockReturnValue({
    preferences,
    setPreferences: vi.fn(),
    isSaving: false,
    isLoading: false,
    isError: false,
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePaymentMethods.mockReturnValue({
    paymentMethods: [methodA, methodB],
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PaymentMethodsList — indicador de solo-lectura 'Predeterminado'", () => {
  it("cero impacto sin config: no aparece ninguna afordancia de 'Predeterminar' ni control editable", () => {
    mockPreferences({});
    renderList();

    expect(screen.queryByText(/predeterminar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Únicos")).not.toBeInTheDocument();
  });

  it("con ≥1 default, muestra estrella + pill(s) por estructura como texto informativo (sin botón)", () => {
    mockPreferences({
      defaultPaymentMethods: { unico: methodA.id, fijo: methodA.id, cuota: null },
    });
    renderList();

    const indicator = screen.getByTitle("Predeterminado de: Únicos, Fijos");
    expect(indicator).toBeInTheDocument();
    expect(indicator.tagName).not.toBe("BUTTON");
    expect(indicator).not.toHaveAttribute("role", "button");
    expect(indicator).not.toHaveAttribute("tabindex");

    // methodB sigue sin defaults → sin indicador
    expect(screen.queryByTitle(/predeterminado de:.*efectivo/i)).not.toBeInTheDocument();
  });

  it("el indicador no es interactivo: no hay botón, popover ni afordancia de edición en la fila", () => {
    mockPreferences({
      defaultPaymentMethods: { unico: methodA.id, fijo: null, cuota: null },
    });
    renderList();

    // No hay ningún <button> asociado al indicador de default (solo el kebab de acciones,
    // que tiene su propio aria-label "Acciones de {nombre}").
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button.getAttribute("aria-label") ?? "").not.toMatch(/predeterminar/i);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("una sola pill por estructura en toda la lista", () => {
    mockPreferences({
      defaultPaymentMethods: { unico: methodA.id, fijo: methodB.id, cuota: null },
    });
    renderList();

    expect(screen.getByTitle("Predeterminado de: Únicos")).toBeInTheDocument();
    expect(screen.getByTitle("Predeterminado de: Fijos")).toBeInTheDocument();
  });
});
