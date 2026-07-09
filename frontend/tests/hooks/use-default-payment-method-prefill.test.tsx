/**
 * Tests del hook useDefaultPaymentMethodPrefill — feature "Método de pago por
 * defecto por estructura" (RF-PM-007).
 *
 * Verifica las reglas cerradas:
 * - Aplica el default una única vez al crear un movimiento de una estructura
 *   (único/fijo/cuota), cuando el campo sigue en "" (no pisa una selección
 *   manual del usuario). Aplica tanto a egresos como a ingresos de esa
 *   estructura — el default es por estructura, no por tipo.
 * - No aplica en edición.
 * - Fallback en lectura: un id que no corresponde a un método activo se trata
 *   como "ninguno" (no se aplica).
 * - Espera a que preferences/paymentMethods carguen antes de decidir — no
 *   aplica mientras isLoading/paymentMethods===undefined.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import type { PaymentMethod } from "@/types/payment-method";
import type { UserPreferences } from "@/types/auth";

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(),
}));

import { usePreferences } from "@/hooks/use-preferences";
import { usePaymentMethods } from "@/hooks/use-payment-methods";

const mockUsePreferences = vi.mocked(usePreferences);
const mockUsePaymentMethods = vi.mocked(usePaymentMethods);

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

function mockPreferences(preferences: UserPreferences, isLoading = false) {
  mockUsePreferences.mockReturnValue({
    preferences,
    setPreferences: vi.fn(),
    isSaving: false,
    isLoading,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof usePreferences>);
}

function mockMethods(paymentMethods: PaymentMethod[] | undefined) {
  mockUsePaymentMethods.mockReturnValue({
    paymentMethods,
    isLoading: paymentMethods === undefined,
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
  } as unknown as ReturnType<typeof usePaymentMethods>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDefaultPaymentMethodPrefill", () => {
  it("aplica el default configurado al crear un movimiento con el campo vacío", () => {
    mockPreferences({ defaultPaymentMethods: { unico: mockDebitMethod.id, fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "unico",
        isEditing: false,
        currentPaymentMethodId: "",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).toHaveBeenCalledWith(mockDebitMethod.id);
  });

  it("no aplica nada si no hay default configurado para ese slot", () => {
    mockPreferences({ defaultPaymentMethods: { unico: null, fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "unico",
        isEditing: false,
        currentPaymentMethodId: "",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).not.toHaveBeenCalled();
  });

  it("no aplica el default en modo edición", () => {
    mockPreferences({ defaultPaymentMethods: { unico: mockDebitMethod.id, fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "unico",
        isEditing: true,
        currentPaymentMethodId: "",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).not.toHaveBeenCalled();
  });

  it("no pisa una selección manual ya hecha por el usuario (campo no vacío)", () => {
    mockPreferences({ defaultPaymentMethods: { unico: mockDebitMethod.id, fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "unico",
        isEditing: false,
        currentPaymentMethodId: "pm-otro-elegido-a-mano",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).not.toHaveBeenCalled();
  });

  it("fallback en lectura: un id que no corresponde a un método activo no se aplica", () => {
    mockPreferences({ defaultPaymentMethods: { unico: "pm-eliminado", fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "unico",
        isEditing: false,
        currentPaymentMethodId: "",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).not.toHaveBeenCalled();
  });

  it("espera a que preferences/paymentMethods carguen antes de aplicar, y aplica cuando resuelven", () => {
    mockPreferences({}, /* isLoading */ true);
    mockMethods(undefined);
    const setPaymentMethodId = vi.fn();

    const { rerender } = renderHook(
      (props: { isLoading: boolean; methods: PaymentMethod[] | undefined }) =>
        useDefaultPaymentMethodPrefill({
          slot: "unico",
          isEditing: false,
          currentPaymentMethodId: "",
          setPaymentMethodId,
        }),
      { initialProps: { isLoading: true, methods: undefined } },
    );

    expect(setPaymentMethodId).not.toHaveBeenCalled();

    // Resuelven ambas queries — preferences con el default configurado, methods con el método activo.
    mockPreferences({ defaultPaymentMethods: { unico: mockDebitMethod.id, fijo: null, cuota: null } });
    mockMethods([mockDebitMethod]);
    rerender({ isLoading: false, methods: [mockDebitMethod] });

    expect(setPaymentMethodId).toHaveBeenCalledWith(mockDebitMethod.id);
  });

  it("lee el slot correcto según el prop 'slot' (fijo/cuota)", () => {
    mockPreferences({
      defaultPaymentMethods: { unico: null, fijo: mockDebitMethod.id, cuota: null },
    });
    mockMethods([mockDebitMethod]);
    const setPaymentMethodId = vi.fn();

    renderHook(() =>
      useDefaultPaymentMethodPrefill({
        slot: "fijo",
        isEditing: false,
        currentPaymentMethodId: "",
        setPaymentMethodId,
      }),
    );

    expect(setPaymentMethodId).toHaveBeenCalledWith(mockDebitMethod.id);
  });
});
