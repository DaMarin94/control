/**
 * Tests de DeleteSimulationDialog (docs/design.md "Simulación de categoría
 * (`/mes`)" §4, RF-SIM-004).
 * Verifica:
 * - Título "Eliminar simulación", caja de identidad con la categoría, nota de consecuencia.
 * - Sin mención al historial.
 * - Sin ✕ (mismo criterio que el resto de las confirmaciones de borrado).
 * - Éxito: toast + cierra. Error: toast.error + el modal queda abierto.
 * - Cancelar no elimina.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteSimulationDialog } from "@/components/movements/delete-simulation-dialog";
import type { SimulationDto } from "@/types/simulation";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-simulations", () => ({
  useDeleteSimulation: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() },
  })),
}));

import { useDeleteSimulation } from "@/hooks/use-simulations";

const mockUseDeleteSimulation = vi.mocked(useDeleteSimulation);
const mockDeleteSimulation = vi.fn();

const simulation: SimulationDto = {
  id: "sim-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Suscripciones", color: "#3B7DE0", scope: "BOTH" },
  monthsWithData: 6,
  paused: false,
  createdAt: "2026-06-01T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDeleteSimulation.mockReturnValue({
    deleteSimulation: mockDeleteSimulation,
    isDeleting: false,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeleteSimulationDialog", () => {
  it("muestra el título y la caja de identidad con la categoría", () => {
    render(<DeleteSimulationDialog simulation={simulation} onClose={vi.fn()} />);
    expect(screen.getByText("Eliminar simulación")).toBeInTheDocument();
    expect(screen.getByText(/se va a eliminar la simulación de/i)).toBeInTheDocument();
    expect(screen.getAllByText("Suscripciones").length).toBeGreaterThan(0);
  });

  it("muestra la nota de consecuencia (totales recalculados)", () => {
    render(<DeleteSimulationDialog simulation={simulation} onClose={vi.fn()} />);
    expect(
      screen.getByText(/sus movimientos simulados dejan de aparecer en los meses futuros/i),
    ).toBeInTheDocument();
  });

  it("NO menciona el historial", () => {
    render(<DeleteSimulationDialog simulation={simulation} onClose={vi.fn()} />);
    expect(screen.queryByText(/historial/i)).not.toBeInTheDocument();
  });

  it("sin botón ✕ (mismo criterio que el resto de las confirmaciones de borrado)", () => {
    render(<DeleteSimulationDialog simulation={simulation} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /cerrar/i })).not.toBeInTheDocument();
  });

  it("cancelar no elimina y llama a onClose", () => {
    const onClose = vi.fn();
    render(<DeleteSimulationDialog simulation={simulation} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(mockDeleteSimulation).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirmar con éxito: llama a deleteSimulation, toast de éxito y cierra", async () => {
    mockDeleteSimulation.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(<DeleteSimulationDialog simulation={simulation} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(mockDeleteSimulation).toHaveBeenCalledWith("sim-1");
      expect(mockToastSuccess).toHaveBeenCalledWith("Simulación eliminada.");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("confirmar con error: toast.error y el modal queda abierto (onClose no se llama)", async () => {
    mockDeleteSimulation.mockResolvedValue({ success: false, error: "La simulación no existe o ya fue eliminada." });
    const onClose = vi.fn();
    render(<DeleteSimulationDialog simulation={simulation} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("La simulación no existe o ya fue eliminada.");
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("en carga: el botón dice 'Eliminando...' y ambos botones se deshabilitan", () => {
    mockUseDeleteSimulation.mockReturnValue({
      deleteSimulation: mockDeleteSimulation,
      isDeleting: true,
    });
    render(<DeleteSimulationDialog simulation={simulation} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /eliminando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });
});
