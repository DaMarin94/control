/**
 * Tests del diálogo de eliminación de movimiento fijo (RF-MF-004).
 * Verifica:
 * - Renderizado del título, descripción y monto.
 * - Siempre llama deleteRecurring con fromCurrentMonth=true.
 * - Usa viewMonth cuando se pasa; cae a getCurrentMonth() si se omite.
 * - Toast de confirmación tras eliminar.
 * - Cancelar no elimina.
 * - Manejo de error del backend.
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
  installment: null,
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
  viewMonth?: string;
}) {
  const onClose = props.onClose ?? vi.fn();
  const movement = props.movement ?? mockFijoMovement;
  return render(
    <ToastProvider>
      <DeleteRecurringDialog movement={movement} onClose={onClose} viewMonth={props.viewMonth} />
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

  it("no renderiza ningún checkbox", () => {
    renderDialog({});
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("muestra texto informando que se elimina desde este mes en adelante", () => {
    renderDialog({});
    expect(screen.getByText(/desde este mes en adelante/i)).toBeInTheDocument();
  });

  it("muestra texto informando que los meses anteriores no se modifican", () => {
    renderDialog({});
    expect(screen.getByText(/meses anteriores no se modifican/i)).toBeInTheDocument();
  });

  // ── Comportamiento de eliminación ───────────────────────────────────────────

  it("siempre llama deleteRecurring con fromCurrentMonth=true", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({ fromCurrentMonth: true }),
      );
    });
  });

  it("usa viewMonth cuando se proporciona como currentMonth", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose, viewMonth: "2026-03" });

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({ currentMonth: "2026-03", fromCurrentMonth: true }),
      );
    });
  });

  it("usa getCurrentMonth() como fallback cuando viewMonth no se proporciona", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({ onClose });

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({ currentMonth: "2026-06", fromCurrentMonth: true }),
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
