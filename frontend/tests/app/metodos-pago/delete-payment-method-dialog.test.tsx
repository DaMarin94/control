/**
 * Tests del diálogo de confirmación de eliminación de método de pago.
 * Verifica: renderizado, cancelar (no llama delete), confirmar (llama delete y cierra).
 * Espejo de tests/app/categorias/delete-category-dialog.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeletePaymentMethodDialog } from "@/app/(app)/metodos-pago/delete-payment-method-dialog";
import { ToastProvider } from "@/components/ui/toast";
import type { PaymentMethod } from "@/types/payment-method";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(),
}));

import { usePaymentMethods } from "@/hooks/use-payment-methods";

const mockUsePaymentMethods = vi.mocked(usePaymentMethods);

const mockPaymentMethod: PaymentMethod = {
  id: "pm-1",
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

function renderDialog(paymentMethod: PaymentMethod, onClose: () => void = vi.fn()) {
  return render(
    <ToastProvider>
      <DeletePaymentMethodDialog paymentMethod={paymentMethod} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeletePaymentMethodDialog", () => {
  const mockDeletePaymentMethod = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePaymentMethods.mockReturnValue({
      paymentMethods: [],
      isLoading: false,
      isError: false,
      error: null,
      createPaymentMethod: vi.fn(),
      updatePaymentMethod: vi.fn(),
      deletePaymentMethod: mockDeletePaymentMethod,
      reactivatePaymentMethod: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isReactivating: false,
    });
  });

  it("muestra el nombre del método a eliminar y las acciones", () => {
    renderDialog(mockPaymentMethod);

    expect(screen.getByText(/Visa Banco Nación/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^eliminar$/i })).toBeInTheDocument();
  });

  it("Cancelar: no llama a deletePaymentMethod y llama a onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(mockPaymentMethod, onClose);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(mockDeletePaymentMethod).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Confirmar: llama a deletePaymentMethod con el id correcto y onClose al éxito", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockDeletePaymentMethod.mockResolvedValue({ success: true });

    renderDialog(mockPaymentMethod, onClose);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(mockDeletePaymentMethod).toHaveBeenCalledWith("pm-1");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("error al eliminar: llama a onClose y no queda bloqueado", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockDeletePaymentMethod.mockResolvedValue({
      success: false,
      error: "No se pudo eliminar el método de pago.",
    });

    renderDialog(mockPaymentMethod, onClose);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("muestra cantidad de movimientos si movementCount > 0", () => {
    renderDialog(mockPaymentMethod); // movementCount: 3

    expect(screen.getByText((_, el) => {
      return el?.tagName === "P" && (el.textContent ?? "").includes("3") && (el.textContent ?? "").toLowerCase().includes("movimientos asociados");
    })).toBeInTheDocument();
  });

  it("no muestra info de movimientos si movementCount es 0", () => {
    const emptyMethod = { ...mockPaymentMethod, movementCount: 0 };
    renderDialog(emptyMethod);

    expect(screen.queryByText(/movimientos asociados/i)).not.toBeInTheDocument();
  });
});
