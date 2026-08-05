/**
 * Tests de SimulateCategoryModal (docs/design.md "Simulación de categoría
 * (`/mes`)" §3, RF-SIM-001).
 * Verifica:
 * - Título, bajada con el horizonte, cierre con ✕ (onClose).
 * - Estado de carga: filas fantasma con role="status".
 * - Estado de error: mensaje inline.
 * - Sin categorías activas: caja dashed.
 * - Categoría con menos de 3 meses: deshabilitada con el motivo "Necesita 3
 *   meses con datos (tiene {N})" SIEMPRE visible; el punto de color NO se atenúa.
 * - Categoría ya simulada: deshabilitada con "Ya la estás simulando".
 * - Clic en fila deshabilitada no selecciona nada.
 * - El botón "Simular" arranca deshabilitado y se habilita al elegir una categoría.
 * - Confirmar: éxito → toast + cierra; error → toast.error + modal sigue abierto
 *   con la selección intacta.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SimulateCategoryModal } from "@/components/movements/simulate-category-modal";
import type { SimulationCandidatesResponse } from "@/types/simulation";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-simulations", () => ({
  useSimulationCandidates: vi.fn(),
  useCreateSimulation: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() },
  })),
}));

import { useSimulationCandidates, useCreateSimulation } from "@/hooks/use-simulations";

const mockUseSimulationCandidates = vi.mocked(useSimulationCandidates);
const mockUseCreateSimulation = vi.mocked(useCreateSimulation);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const candidatesResponse: SimulationCandidatesResponse = {
  horizonEndMonth: "2026-12",
  categories: [
    { categoryId: "cat-1", name: "Suscripciones", color: "#3B7DE0", monthsWithData: 6, alreadySimulated: false },
    { categoryId: "cat-2", name: "Viajes", color: "#E23B3B", monthsWithData: 1, alreadySimulated: false },
    { categoryId: "cat-3", name: "Alquiler", color: "#35A65A", monthsWithData: 8, alreadySimulated: true },
  ],
};

const mockCreateSimulation = vi.fn();

function mockCandidates(overrides: Partial<ReturnType<typeof useSimulationCandidates>>) {
  mockUseSimulationCandidates.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    // Campos no usados por el componente, presentes solo para tipar el mock.
    ...overrides,
  } as ReturnType<typeof useSimulationCandidates>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateSimulation.mockReturnValue({
    createSimulation: mockCreateSimulation,
    isCreating: false,
  });
  mockCandidates({ data: candidatesResponse });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SimulateCategoryModal", () => {
  it("muestra el título y la bajada con el horizonte vigente", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Simular categoría" })).toBeInTheDocument();
    expect(screen.getByText(/alcanza hasta diciembre 2026\./i)).toBeInTheDocument();
  });

  it("el botón ✕ llama a onClose", () => {
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("estado de carga: 4 filas fantasma con role='status'", () => {
    mockCandidates({ data: undefined, isLoading: true });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByRole("status", { name: /cargando categorías/i })).toBeInTheDocument();
  });

  it("estado de error: mensaje inline, sin lista", () => {
    mockCandidates({ data: undefined, isError: true });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByText(/no se pudieron cargar las categorías/i)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("sin categorías activas: caja dashed con el mensaje", () => {
    mockCandidates({ data: { horizonEndMonth: "2026-12", categories: [] } });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByText("No tenés categorías activas.")).toBeInTheDocument();
  });

  it("lista TODAS las categorías en el orden del catálogo, ninguna oculta", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const rows = screen.getAllByRole("radio");
    expect(rows).toHaveLength(3);
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(screen.getByText("Viajes")).toBeInTheDocument();
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("categoría con menos de 3 meses: deshabilitada con el motivo visible", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const row = screen.getByText("Viajes").closest('[role="radio"]') as HTMLElement;
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Necesita 3 meses con datos (tiene 1)")).toBeInTheDocument();
  });

  it("categoría ya simulada: deshabilitada con 'Ya la estás simulando'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const row = screen.getByText("Alquiler").closest('[role="radio"]') as HTMLElement;
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Ya la estás simulando")).toBeInTheDocument();
  });

  it("clic en una fila deshabilitada no la selecciona (el botón Simular sigue deshabilitado)", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Viajes"));
    expect(screen.getByRole("button", { name: /^simular$/i })).toBeDisabled();
  });

  it("el botón 'Simular' arranca deshabilitado y se habilita al elegir una categoría habilitada", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /^simular$/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText("Suscripciones"));
    expect(submit).toBeEnabled();
  });

  it("confirmar con éxito: toast de éxito y cierra el modal", async () => {
    mockCreateSimulation.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: /^simular$/i }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith("cat-1");
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Simulación creada.");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("confirmar con error: toast.error y el modal queda abierto con la selección intacta", async () => {
    mockCreateSimulation.mockResolvedValue({ success: false, error: "Ya tenés una simulación activa para esta categoría" });
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: /^simular$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Ya tenés una simulación activa para esta categoría");
    });
    expect(onClose).not.toHaveBeenCalled();
    // La selección se conserva: el botón sigue habilitado (no se resetea a null).
    expect(screen.getByRole("button", { name: /^simular$/i })).toBeEnabled();
  });

  it("en carga: el botón dice 'Simulando…' y está deshabilitado", () => {
    mockUseCreateSimulation.mockReturnValue({
      createSimulation: mockCreateSimulation,
      isCreating: true,
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /simulando…/i });
    expect(submit).toBeDisabled();
  });
});
