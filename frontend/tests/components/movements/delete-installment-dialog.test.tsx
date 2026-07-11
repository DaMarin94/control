/**
 * Tests del diálogo de eliminación de grupo de cuotas (RF-MC-002).
 * Verifica:
 * - Muestra el aviso de que se elimina el GRUPO COMPLETO (todas las cuotas).
 * - Sin checkbox (la eliminación es siempre total).
 * - Llama deleteInstallment(id) al confirmar (sin query params).
 * - Toast de confirmación tras eliminar.
 * - Cancelar no elimina.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DeleteInstallmentDialog } from "@/components/movements/delete-installment-dialog";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(),
}));

import { useInstallments } from "@/hooks/use-installments";

const mockUseInstallments = vi.mocked(useInstallments);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockCuotaMovement: MovementItem = {
  id: "inst-1",
  origin: "cuota",
  type: "EXPENSE",
  amountCents: 50000,
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: {
    number: 3,
    total: 12,
    startMonth: "2026-01",
  },
  frequency: null,
  startMonth: null,
  endMonth: null,
  skipped: false,
  category: {
    id: "cat-1",
    name: "Tecnología",
    color: "#FF5733",
    scope: "EXPENSE",
  },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 50000,
  calculatedChildren: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDialog(props: {
  movement?: MovementItem;
  onClose?: () => void;
}) {
  const onClose = props.onClose ?? vi.fn();
  const movement = props.movement ?? mockCuotaMovement;
  return render(
    <ToastProvider>
      <DeleteInstallmentDialog movement={movement} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockDeleteInstallment = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockUseInstallments.mockReturnValue({
    createInstallment: vi.fn(),
    updateInstallment: vi.fn(),
    deleteInstallment: mockDeleteInstallment,
    skipInstallment: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeleteInstallmentDialog", () => {
  // ── Renderizado inicial ──────────────────────────────────────────────────────

  it("muestra el diálogo con título 'Eliminar grupo de cuotas'", () => {
    renderDialog({});
    expect(screen.getByText(/eliminar grupo de cuotas/i)).toBeInTheDocument();
  });

  it("muestra la información del movimiento (descripción y monto)", () => {
    renderDialog({});
    expect(screen.getByText("Notebook")).toBeInTheDocument();
    // 50000 centavos = $500,00
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
  });

  it("muestra el número de cuota X/N (3/12)", () => {
    renderDialog({});
    expect(screen.getByText(/3\/12/)).toBeInTheDocument();
  });

  // ── Advertencia de grupo completo (RF-MC-002) ────────────────────────────────

  it("advierte explícitamente que se elimina el GRUPO COMPLETO (todas las cuotas)", () => {
    renderDialog({});
    // Debe indicar que se eliminan todas las cuotas, no solo la del mes visible
    expect(screen.getByText(/grupo completo/i)).toBeInTheDocument();
    expect(screen.getByText(/todas las cuotas/i)).toBeInTheDocument();
  });

  it("indica que la acción es permanente", () => {
    renderDialog({});
    expect(screen.getByText(/permanente/i)).toBeInTheDocument();
  });

  // ── Sin checkbox ─────────────────────────────────────────────────────────────

  it("NO muestra un checkbox (la eliminación siempre es total)", () => {
    renderDialog({});
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  // ── Confirmar eliminación ────────────────────────────────────────────────────

  it("al confirmar llama deleteInstallment con el id del movimiento", async () => {
    mockDeleteInstallment.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar grupo/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteInstallment).toHaveBeenCalledWith("inst-1");
    });
  });

  it("al confirmar exitosamente llama a onClose", async () => {
    mockDeleteInstallment.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar grupo/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── Cancelar ────────────────────────────────────────────────────────────────

  it("cancelar no llama a deleteInstallment", () => {
    renderDialog({});

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(mockDeleteInstallment).not.toHaveBeenCalled();
  });

  it("cancelar llama a onClose", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });

  // ── Error del backend ────────────────────────────────────────────────────────

  it("ante error del backend, llama a onClose (no deja el diálogo en estado roto)", async () => {
    mockDeleteInstallment.mockResolvedValue({
      success: false,
      error: "Ocurrió un error al eliminar el movimiento. Intentalo de nuevo.",
    });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar grupo/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteInstallment).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
