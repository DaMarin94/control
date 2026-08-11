/**
 * Tests del diálogo de eliminación de movimiento fijo (RF-MF-004) y
 * de la variante "calculated-simple" para calculados de único/cuota (Fase 1.1.8).
 *
 * Variante "fijo" (default) — verifica:
 * - Renderizado del título, descripción y monto.
 * - No hay checkbox (la confirmación no ofrece opciones — RF-MF-004).
 * - Siempre llama deleteRecurring con fromCurrentMonth=true.
 * - Usa viewMonth cuando se pasa como currentMonth; cae a getCurrentMonth() si se omite.
 * - Toast de confirmación tras eliminar.
 * - Cancelar no elimina.
 * - Manejo de error del backend.
 *
 * Variante "calculated-simple" — verifica:
 * - Título "Eliminar movimiento calculado".
 * - Copy directo sin texto de recurrencia ("desde este mes en adelante").
 * - Llama deleteRecurring con fromCurrentMonth=true y viewMonth como currentMonth.
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

// El toast de "Deshacer" tras eliminar usa useUndoHistory — mockeado para no
// depender de useApi/useSession real en este test de diálogo.
vi.mock("@/hooks/use-history", () => ({
  useUndoHistory: vi.fn(() => ({ undo: vi.fn(), isUndoing: false })),
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
  frequency: 1,
  startMonth: "2026-01",
  endMonth: null,
  chainId: "chain-rec-1",
  skipped: false,
  category: {
    id: "cat-1",
    name: "Servicios",
    color: "#FF5733",
    scope: "EXPENSE",
  },
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

/** Calculado de origen único — fixture para la variante calculated-simple */
const mockCalculatedUnicoMovement: MovementItem = {
  id: "calc-unico-1",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 5000,
  description: "Calculado de almuerzo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  chainId: null,
  skipped: false,
  category: {
    id: "cat-2",
    name: "Alimentación",
    color: "#33FF57",
    scope: "EXPENSE",
  },
  paymentMethod: null,
  autoDebit: null,
  calculated: {
    sourceType: "unico",
    sourceId: "mov-1",
    sourceChainId: null,
    sourceDescription: "Almuerzo en el trabajo",
    formulaOperator: "PCT",
    formulaOperand: 1000,
    formulaSign: 1,
    sourceAmountCents: 50000,
  },
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 5000,
  simulated: false,
  calculatedChildren: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDialog(props: {
  movement?: MovementItem;
  onClose?: () => void;
  viewMonth?: string;
  variant?: "fijo" | "calculated-simple";
}) {
  const onClose = props.onClose ?? vi.fn();
  const movement = props.movement ?? mockFijoMovement;
  return render(
    <ToastProvider>
      <DeleteRecurringDialog
        movement={movement}
        onClose={onClose}
        viewMonth={props.viewMonth}
        variant={props.variant}
      />
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
    skipRecurring: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
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

  it("no renderiza ningún checkbox (la confirmación no ofrece opciones — RF-MF-004)", () => {
    renderDialog({});
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  // ── Callout de advertencia (hasCalculated) ───────────────────────────────────

  it("NO muestra el callout de advertencia cuando hasCalculated === false", () => {
    renderDialog({});
    expect(
      screen.queryByText(/movimientos calculados que dependen de él/i),
    ).not.toBeInTheDocument();
  });

  it("muestra el callout de advertencia cuando hasCalculated === true", () => {
    const movementWithCalculated: MovementItem = { ...mockFijoMovement, hasCalculated: true };
    renderDialog({ movement: movementWithCalculated });
    expect(
      screen.getByText(/Este movimiento fijo tiene movimientos calculados que dependen de él/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Si lo eliminás, esos calculados también se eliminarán/i),
    ).toBeInTheDocument();
  });

  it("el callout no tiene role='alert' (es contenido estático del diálogo)", () => {
    const movementWithCalculated: MovementItem = { ...mockFijoMovement, hasCalculated: true };
    renderDialog({ movement: movementWithCalculated });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("informa que el fijo dejará de aparecer desde este mes en adelante", () => {
    renderDialog({});
    expect(screen.getByText(/desde este mes en adelante/i)).toBeInTheDocument();
  });

  it("informa que los meses anteriores no se modifican", () => {
    renderDialog({});
    expect(screen.getByText(/meses anteriores no se modifican/i)).toBeInTheDocument();
  });

  // ── Comportamiento de eliminación ───────────────────────────────────────────

  it("siempre llama deleteRecurring con fromCurrentMonth=true (RF-MF-004)", async () => {
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

// ─── Variante calculated-simple (calculados de único/cuota) ──────────────────

describe("DeleteRecurringDialog — variante calculated-simple", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRecurring.mockReturnValue({
      createRecurring: vi.fn(),
      updateRecurring: vi.fn(),
      deleteRecurring: mockDeleteRecurring,
      skipRecurring: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isSkipping: false,
    });
  });

  it("muestra el título 'Eliminar movimiento calculado'", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.getByRole("heading", { name: /eliminar movimiento calculado/i })).toBeInTheDocument();
  });

  it("NO muestra el título 'Eliminar movimiento fijo'", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.queryByRole("heading", { name: /eliminar movimiento fijo/i })).not.toBeInTheDocument();
  });

  it("muestra el copy de confirmación directa", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.getByText(/estás seguro de que querés eliminar este movimiento calculado/i)).toBeInTheDocument();
  });

  it("NO muestra copy de recurrencia ('desde este mes en adelante')", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.queryByText(/desde este mes en adelante/i)).not.toBeInTheDocument();
  });

  it("NO muestra copy de meses anteriores ('meses anteriores no se modifican')", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.queryByText(/meses anteriores no se modifican/i)).not.toBeInTheDocument();
  });

  it("muestra descripción y monto del movimiento", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.getByText("Calculado de almuerzo")).toBeInTheDocument();
    // 5000 centavos = $50,00
    expect(screen.getByText(/50,00/)).toBeInTheDocument();
  });

  it("no hay checkbox", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("llama a deleteRecurring con fromCurrentMonth=true y viewMonth como currentMonth", async () => {
    mockDeleteRecurring.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      onClose,
      viewMonth: "2026-06",
      variant: "calculated-simple",
    });

    const confirmBtn = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteRecurring).toHaveBeenCalledWith(
        "calc-unico-1",
        expect.objectContaining({ currentMonth: "2026-06", fromCurrentMonth: true }),
      );
    });
  });

  it("cancelar no llama a deleteRecurring", () => {
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      variant: "calculated-simple",
    });

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(mockDeleteRecurring).not.toHaveBeenCalled();
  });

  it("cancelar llama a onClose", () => {
    const onClose = vi.fn();
    renderDialog({
      movement: mockCalculatedUnicoMovement,
      onClose,
      variant: "calculated-simple",
    });

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
