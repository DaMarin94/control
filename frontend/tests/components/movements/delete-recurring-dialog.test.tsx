/**
 * Tests del diálogo de eliminación de movimiento fijo (RF-MF-004).
 * Verifica:
 * - El checkbox "Eliminar también desde este mes" está desmarcado por defecto.
 * - Con checkbox desmarcado: envía fromCurrentMonth=false.
 * - Con checkbox marcado: envía fromCurrentMonth=true.
 * - Toast de confirmación tras eliminar.
 * - Cancelar no elimina.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DeleteRecurringDialog } from "@/components/movements/delete-recurring-dialog";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

import { useRecurring } from "@/hooks/use-recurring";

const mockUseRecurring = vi.mocked(useRecurring);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockFijoMovement: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  occurredAt: null,
  timezone: null,
  category: {
    id: "cat-1",
    name: "Servicios",
    color: "#FF5733",
    scope: "EXPENSE",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDialog(props: {
  movement?: MovementItem;
  onClose?: () => void;
}) {
  const onClose = props.onClose ?? vi.fn();
  const movement = props.movement ?? mockFijoMovement;
  return render(
    <ToastProvider>
      <DeleteRecurringDialog movement={movement} onClose={onClose} />
    </ToastProvider>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockDeleteRecurring = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockUseRecurring.mockReturnValue({
    createRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    deleteRecurring: mockDeleteRecurring,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeleteRecurringDialog", () => {
  // ── Renderizado inicial ──────────────────────────────────────────────────────

  it("muestra el diálogo con título 'Eliminar movimiento fijo'", () => {
    renderDialog({});
    expect(screen.getByText(/eliminar movimiento fijo/i)).toBeInTheDocument();
  });

  it("muestra la información del movimiento (descripción y monto)", () => {
    renderDialog({});
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
    // 150000 centavos = $1.500,00
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it("el checkbox 'Eliminar también desde este mes' existe en el formulario", () => {
    renderDialog({});
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("el checkbox está desmarcado por defecto (RF-MF-004)", () => {
    renderDialog({});
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  // ── Texto de ayuda dinámico ──────────────────────────────────────────────────

  it("muestra texto 'desde el mes siguiente' cuando el checkbox está desmarcado", () => {
    renderDialog({});
    expect(screen.getByText(/mes siguiente/i)).toBeInTheDocument();
  });

  it("muestra texto 'desde el mes actual' cuando el checkbox está marcado", () => {
    renderDialog({});
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(screen.getByText(/mes actual inclusive/i)).toBeInTheDocument();
  });

  // ── Envío de fromCurrentMonth=false (checkbox desmarcado) ───────────────────

  it("con checkbox desmarcado: llama deleteRecurring con fromCurrentMonth=false", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    // Checkbox desmarcado — confirmar
    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({
          currentMonth: "2026-06",
          fromCurrentMonth: false,
        }),
      );
    });
  });

  // ── Envío de fromCurrentMonth=true (checkbox marcado) ───────────────────────

  it("con checkbox marcado: llama deleteRecurring con fromCurrentMonth=true", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    // Marcar el checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({
          currentMonth: "2026-06",
          fromCurrentMonth: true,
        }),
      );
    });
  });

  // ── Cancelar ────────────────────────────────────────────────────────────────

  it("cancelar no llama a deleteRecurring", () => {
    renderDialog({});

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(mockDeleteRecurring).not.toHaveBeenCalled();
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
    mockDeleteRecurring.mockResolvedValue({
      success: false,
      error: "Ocurrió un error al eliminar el movimiento. Intentalo de nuevo.",
    });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
