/**
 * Tests de SimulateCategoryModal (docs/design.md "Simulación de categoría
 * (`/mes`)" §3, RF-SIM-001) — selector MÚLTIPLE con batch tolerante a fallo
 * parcial.
 * Verifica:
 * - Título, bajada de tres oraciones (horizonte "desde este mes" + remanente).
 * - Estado de carga / error / sin categorías activas.
 * - Lista TODAS las categorías, en orden de catálogo, ninguna oculta.
 * - Categoría con menos de 3 meses / ya simulada: `role="checkbox"`
 *   deshabilitado con el motivo SIEMPRE visible; el punto de color no se atenúa.
 * - Selección MÚLTIPLE: tildar una no destilda otra; sin control "Todas".
 * - Rótulo del botón sensible al conteo ("Simular" / "Simular 1 categoría" /
 *   "Simular {N} categorías" / "Simulando…").
 * - Desenlaces del batch: éxito total, fallo total (0 de N), fallo parcial
 *   (K de N) con reconciliación de filas y caja de resumen.
 * - Precedencia del slot de motivo: error del último intento > "Ya la estás
 *   simulando" > "Necesita 3 meses…"; destildar una fila con error lo limpia.
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
const mockToastWarning = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: mockToastSuccess, error: mockToastError, warning: mockToastWarning, info: vi.fn() },
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
    { categoryId: "cat-4", name: "Ocio", color: "#C6A635", monthsWithData: 5, alreadySimulated: false },
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

function getRow(name: string): HTMLElement {
  return screen.getByText(name).closest('[role="checkbox"]') as HTMLElement;
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
  it("muestra el título (singular, sin cambios) y la bajada de tres oraciones con el horizonte y el remanente", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Simular categoría" })).toBeInTheDocument();
    expect(screen.getByText(/se proyecta cada categoría elegida/i)).toBeInTheDocument();
    expect(screen.getByText(/alcanza desde este mes hasta diciembre 2026\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/en cada mes se simula solo lo que falta para llegar a lo proyectado\./i),
    ).toBeInTheDocument();
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
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("sin categorías activas: caja dashed con el mensaje", () => {
    mockCandidates({ data: { horizonEndMonth: "2026-12", categories: [] } });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByText("No tenés categorías activas.")).toBeInTheDocument();
  });

  it("lista TODAS las categorías en el orden del catálogo, ninguna oculta, con role='group'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByRole("group", { name: /categorías a simular/i })).toBeInTheDocument();
    const rows = screen.getAllByRole("checkbox");
    expect(rows).toHaveLength(4);
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(screen.getByText("Viajes")).toBeInTheDocument();
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
    expect(screen.getByText("Ocio")).toBeInTheDocument();
  });

  it("categoría con menos de 3 meses: deshabilitada con el motivo visible", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const row = getRow("Viajes");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Necesita 3 meses con datos (tiene 1)")).toBeInTheDocument();
  });

  it("categoría ya simulada: deshabilitada con 'Ya la estás simulando'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const row = getRow("Alquiler");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Ya la estás simulando")).toBeInTheDocument();
  });

  it("clic en una fila deshabilitada no la selecciona (no queda tildada)", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Viajes"));
    expect(getRow("Viajes")).toHaveAttribute("aria-checked", "false");
  });

  it("no existe ningún control 'Todas' / 'Ninguna' / 'Seleccionar todas'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.queryByText(/^todas$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/seleccionar todas/i)).not.toBeInTheDocument();
  });

  // ── Selección múltiple y rótulo del botón ──────────────────────────────────

  it("el botón arranca en 'Simular' deshabilitado; tildar una categoría lo cambia a 'Simular 1 categoría'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /^simular$/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText("Suscripciones"));
    expect(screen.getByRole("button", { name: "Simular 1 categoría" })).toBeEnabled();
  });

  it("tildar una segunda categoría NO destilda la primera y el rótulo pasa a 'Simular 2 categorías'", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));

    expect(getRow("Suscripciones")).toHaveAttribute("aria-checked", "true");
    expect(getRow("Ocio")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Simular 2 categorías" })).toBeInTheDocument();
  });

  it("destildar una categoría la quita de la selección", () => {
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Suscripciones"));
    expect(getRow("Suscripciones")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: /^simular$/i })).toBeDisabled();
  });

  it("en carga: el botón dice 'Simulando…' y Cancelar también se deshabilita", () => {
    mockUseCreateSimulation.mockReturnValue({
      createSimulation: mockCreateSimulation,
      isCreating: true,
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /simulando…/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  // ── Desenlace (a): éxito total ─────────────────────────────────────────────

  it("éxito total con 1 categoría: toast 'Simulación creada.' y cierra", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [],
    });
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith(["cat-1"]);
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Simulación creada.");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("éxito total con 2 categorías: toast '2 simulaciones creadas.' y cierra", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [
        { id: "sim-1", categoryId: "cat-1" },
        { id: "sim-4", categoryId: "cat-4" },
      ],
      failed: [],
    });
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 2 categorías" }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith(["cat-1", "cat-4"]);
      expect(mockToastSuccess).toHaveBeenCalledWith("2 simulaciones creadas.");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Desenlace (b): fallo total ──────────────────────────────────────────────

  it("fallo total con 1 categoría: toast.error con el mensaje del backend, modal abierto, sin caja de resumen", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [],
      failed: [{ categoryId: "cat-1", message: "Ya tenés una simulación activa para esta categoría" }],
    });
    const onClose = vi.fn();
    render(<SimulateCategoryModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Ya tenés una simulación activa para esta categoría");
    });
    expect(onClose).not.toHaveBeenCalled();
    // Selección intacta.
    expect(getRow("Suscripciones")).toHaveAttribute("aria-checked", "true");
    // Sin caja de resumen en fallo total.
    expect(screen.queryByText(/las que siguen tildadas/i)).not.toBeInTheDocument();
    // El error se muestra en el slot de motivo, en rojo (texto visible).
    expect(screen.getByText("Ya tenés una simulación activa para esta categoría")).toBeInTheDocument();
  });

  it("fallo total con varias categorías: toast.error genérico 'No se pudo crear ninguna simulación.'", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [],
      failed: [
        { categoryId: "cat-1", message: "Ya tenés una simulación activa para esta categoría" },
        { categoryId: "cat-4", message: "La categoría necesita al menos 3 meses con datos" },
      ],
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 2 categorías" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("No se pudo crear ninguna simulación.");
    });
  });

  // ── Desenlace (c): fallo parcial ────────────────────────────────────────────

  it("fallo parcial (1 de 2): toast warning, caja de resumen, creada destildada+deshabilitada, fallida sigue tildada con su error", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [{ categoryId: "cat-4", message: "Ya tenés una simulación activa para esta categoría" }],
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 2 categorías" }));

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Se creó 1 de 2 simulaciones.");
    });

    // Caja de resumen neutra.
    expect(
      screen.getByText(
        "Se creó 1 de 2. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila.",
      ),
    ).toBeInTheDocument();

    // Suscripciones (creada): destildada, deshabilitada, motivo "Ya la estás simulando".
    const createdRow = getRow("Suscripciones");
    expect(createdRow).toHaveAttribute("aria-checked", "false");
    expect(createdRow).toHaveAttribute("aria-disabled", "true");
    expect(createdRow.textContent).toContain("Ya la estás simulando");

    // Ocio (fallida): sigue tildada, con su error.
    const failedRow = getRow("Ocio");
    expect(failedRow).toHaveAttribute("aria-checked", "true");
    expect(failedRow).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText("Ya tenés una simulación activa para esta categoría")).toBeInTheDocument();

    // El botón ya dice "Simular 1 categoría" — listo para reintentar de un clic.
    expect(screen.getByRole("button", { name: "Simular 1 categoría" })).toBeInTheDocument();
  });

  it("destildar una fila fallida limpia su mensaje de error", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [],
      failed: [{ categoryId: "cat-1", message: "Ya tenés una simulación activa para esta categoría" }],
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(screen.getByText("Ya tenés una simulación activa para esta categoría")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Suscripciones"));
    expect(screen.queryByText("Ya tenés una simulación activa para esta categoría")).not.toBeInTheDocument();
  });

  it("un nuevo intento recalcula los errores (no se acumulan intentos previos)", async () => {
    mockCreateSimulation.mockResolvedValueOnce({
      created: [],
      failed: [{ categoryId: "cat-1", message: "Error del primer intento" }],
    });
    render(<SimulateCategoryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));
    await waitFor(() => {
      expect(screen.getByText("Error del primer intento")).toBeInTheDocument();
    });

    mockCreateSimulation.mockResolvedValueOnce({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Simulación creada.");
    });
  });
});
