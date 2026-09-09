/**
 * Tests de SimulateCategoryModal (docs/design.md "Simulación de categoría
 * (`/mes`)" §3, RF-SIM-001) — selector MÚLTIPLE que muestra SOLO categorías
 * SIMULABLES, con batch tolerante a fallo parcial.
 * Verifica:
 * - Título, bajada de tres oraciones (tramo con los dos meses nombrados + remanente).
 * - `startMonth` (mes visualizado) se manda a `useSimulationCandidates` y a `createSimulation`.
 * - Estado de carga / error.
 * - La lista muestra SOLO las candidatas SIMULABLES (≥3 meses, no ya simuladas) —
 *   las no elegibles NO aparecen (ni tildables ni deshabilitadas).
 * - Universo CONGELADO al abrir: un refetch en vuelo con datos distintos no
 *   hace desaparecer ni aparecer filas mientras el modal sigue montado.
 * - Los CUATRO estados vacíos por causa (§3.8) y la nota de elegibilidad (§3.1b),
 *   que no se monta junto al empty ni con la lista vacía.
 * - Selección MÚLTIPLE: tildar una no destilda otra; sin control "Todas".
 * - Rótulo del botón sensible al conteo ("Simular" / "Simular 1 categoría" /
 *   "Simular {N} categorías" / "Simulando…").
 * - Desenlaces del batch: éxito total, fallo total (0 de N), fallo parcial
 *   (K de N) con reconciliación de filas (slot de DESENLACE, sin precedencia:
 *   error del intento o "Simulación creada.", nunca "Ya la estás simulando").
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

const VIEWED_MONTH = "2026-06";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Solo dos de las cuatro son SIMULABLES: Suscripciones (6 meses, no simulada)
// y Ocio (5 meses, no simulada). Viajes tiene <3 meses; Alquiler ya está
// simulada. Las dos no elegibles NO deben renderizarse.
const candidatesResponse: SimulationCandidatesResponse = {
  startMonth: "2026-06",
  endMonth: "2026-12",
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

function renderModal(onClose = vi.fn()) {
  return render(<SimulateCategoryModal startMonth={VIEWED_MONTH} onClose={onClose} />);
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
  it("pide las candidatas con el startMonth del mes visualizado", () => {
    renderModal();
    expect(mockUseSimulationCandidates).toHaveBeenCalledWith(true, VIEWED_MONTH);
  });

  it("parado en un MES FUTURO: manda ESE mes (no el en curso) como startMonth al crear (§0, cambio 1)", async () => {
    const FUTURE_MONTH = "2026-10";
    mockCandidates({
      data: { startMonth: "2026-10", endMonth: "2027-04", categories: candidatesResponse.categories },
    });
    mockCreateSimulation.mockResolvedValue({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [],
    });
    render(<SimulateCategoryModal startMonth={FUTURE_MONTH} onClose={vi.fn()} />);

    expect(mockUseSimulationCandidates).toHaveBeenCalledWith(true, FUTURE_MONTH);
    expect(screen.getByText(/alcanza desde octubre 2026 hasta abril 2027\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith(["cat-1"], FUTURE_MONTH);
    });
  });

  it("muestra el título (singular, sin cambios) y la bajada de tres oraciones con el tramo (dos meses nombrados) y el remanente", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Simular categoría" })).toBeInTheDocument();
    expect(screen.getByText(/se proyecta cada categoría elegida/i)).toBeInTheDocument();
    expect(screen.getByText(/alcanza desde junio 2026 hasta diciembre 2026\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/en cada mes se simula solo lo que falta para llegar a lo proyectado\./i),
    ).toBeInTheDocument();
  });

  it("el botón ✕ llama a onClose", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("estado de carga: 4 filas fantasma con role='status'", () => {
    mockCandidates({ data: undefined, isLoading: true });
    renderModal();
    expect(screen.getByRole("status", { name: /cargando categorías/i })).toBeInTheDocument();
  });

  it("estado de error: mensaje inline, sin lista", () => {
    mockCandidates({ data: undefined, isError: true });
    renderModal();
    expect(screen.getByText(/no se pudieron cargar las categorías/i)).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  // ── Filtrado a SOLO simulables (§3, reversión) ─────────────────────────────

  it("lista SOLO las categorías simulables — las no elegibles no aparecen (ni tildables ni deshabilitadas)", () => {
    renderModal();
    expect(screen.getByRole("group", { name: /categorías a simular/i })).toBeInTheDocument();
    const rows = screen.getAllByRole("checkbox");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(screen.getByText("Ocio")).toBeInTheDocument();
    expect(screen.queryByText("Viajes")).not.toBeInTheDocument();
    expect(screen.queryByText("Alquiler")).not.toBeInTheDocument();
  });

  it("al abrir, ninguna fila está deshabilitada y ninguna tiene texto a la derecha (slot de desenlace vacío en reposo)", () => {
    renderModal();
    for (const row of screen.getAllByRole("checkbox")) {
      expect(row).not.toHaveAttribute("aria-disabled");
    }
    expect(screen.queryByText(/necesita 3 meses/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ya la estás simulando/i)).not.toBeInTheDocument();
  });

  it("muestra la nota de elegibilidad al pie de la lista (§3.1b)", () => {
    renderModal();
    expect(
      screen.getByText(
        "Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando.",
      ),
    ).toBeInTheDocument();
  });

  it("no existe ningún control 'Todas' / 'Ninguna' / 'Seleccionar todas'", () => {
    renderModal();
    expect(screen.queryByText(/^todas$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/seleccionar todas/i)).not.toBeInTheDocument();
  });

  // ── Universo CONGELADO al abrir (§3) ───────────────────────────────────────

  it("el universo se congela con el primer payload: un refetch posterior con datos distintos no cambia la lista", () => {
    const { rerender } = renderModal();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    // Simula un refetch en vuelo que trae un catálogo distinto (p. ej. otra
    // pestaña simuló "Ocio" mientras el modal seguía abierto).
    mockCandidates({
      data: {
        startMonth: "2026-06",
        endMonth: "2026-12",
        categories: [
          { categoryId: "cat-1", name: "Suscripciones", color: "#3B7DE0", monthsWithData: 6, alreadySimulated: false },
        ],
      },
    });
    rerender(<SimulateCategoryModal startMonth={VIEWED_MONTH} onClose={vi.fn()} />);

    // La lista sigue mostrando las DOS originales — ninguna fila desapareció.
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("Ocio")).toBeInTheDocument();
  });

  // ── Los cuatro estados vacíos por causa (§3.8) ─────────────────────────────

  it("vacío: sin categorías activas (catálogo vacío)", () => {
    mockCandidates({ data: { startMonth: "2026-06", endMonth: "2026-12", categories: [] } });
    renderModal();
    expect(screen.getByText("No tenés categorías activas.")).toBeInTheDocument();
    // Sin nota de elegibilidad junto al empty.
    expect(screen.queryByText(/solo aparecen las categorías/i)).not.toBeInTheDocument();
  });

  it("vacío: ninguna categoría llega a 3 meses con datos", () => {
    mockCandidates({
      data: {
        startMonth: "2026-06",
        endMonth: "2026-12",
        categories: [
          { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 0, alreadySimulated: false },
          { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 2, alreadySimulated: false },
        ],
      },
    });
    renderModal();
    expect(screen.getByText("Ninguna categoría llega a 3 meses con datos.")).toBeInTheDocument();
    expect(screen.getByText("Cuando alguna los acumule, va a aparecer acá.")).toBeInTheDocument();
  });

  it("vacío: todas las elegibles ya están simuladas", () => {
    mockCandidates({
      data: {
        startMonth: "2026-06",
        endMonth: "2026-12",
        categories: [
          { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 6, alreadySimulated: true },
          { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 8, alreadySimulated: true },
        ],
      },
    });
    renderModal();
    expect(
      screen.getByText("Ya estás simulando todas las categorías que se pueden simular."),
    ).toBeInTheDocument();
    expect(screen.getByText("Podés verlas y eliminarlas en el filtro de Únicos.")).toBeInTheDocument();
  });

  it("vacío: mixto — unas sin datos, el resto ya simuladas", () => {
    mockCandidates({
      data: {
        startMonth: "2026-06",
        endMonth: "2026-12",
        categories: [
          { categoryId: "cat-1", name: "A", color: "#000", monthsWithData: 1, alreadySimulated: false },
          { categoryId: "cat-2", name: "B", color: "#000", monthsWithData: 6, alreadySimulated: true },
        ],
      },
    });
    renderModal();
    expect(screen.getByText("No queda ninguna categoría para simular.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Las que tienen 3 o más meses de datos ya las estás simulando; al resto todavía le faltan meses.",
      ),
    ).toBeInTheDocument();
  });

  it("con la lista vacía, el botón primario está deshabilitado y dice 'Simular'", () => {
    mockCandidates({ data: { startMonth: "2026-06", endMonth: "2026-12", categories: [] } });
    renderModal();
    expect(screen.getByRole("button", { name: /^simular$/i })).toBeDisabled();
  });

  // ── Selección múltiple y rótulo del botón ──────────────────────────────────

  it("el botón arranca en 'Simular' deshabilitado; tildar una categoría lo cambia a 'Simular 1 categoría'", () => {
    renderModal();
    const submit = screen.getByRole("button", { name: /^simular$/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText("Suscripciones"));
    expect(screen.getByRole("button", { name: "Simular 1 categoría" })).toBeEnabled();
  });

  it("tildar una segunda categoría NO destilda la primera y el rótulo pasa a 'Simular 2 categorías'", () => {
    renderModal();
    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));

    expect(getRow("Suscripciones")).toHaveAttribute("aria-checked", "true");
    expect(getRow("Ocio")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Simular 2 categorías" })).toBeInTheDocument();
  });

  it("destildar una categoría la quita de la selección", () => {
    renderModal();
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
    renderModal();
    expect(screen.getByRole("button", { name: /simulando…/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  // ── Desenlace (a): éxito total ─────────────────────────────────────────────

  it("éxito total con 1 categoría: manda el startMonth del mes visualizado y toast 'Simulación creada.'", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [],
    });
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 1 categoría" }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith(["cat-1"], VIEWED_MONTH);
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
    renderModal(onClose);

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 2 categorías" }));

    await waitFor(() => {
      expect(mockCreateSimulation).toHaveBeenCalledWith(["cat-1", "cat-4"], VIEWED_MONTH);
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
    renderModal(onClose);

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
    // El error se muestra en el slot de desenlace, en rojo (texto visible).
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
    renderModal();

    fireEvent.click(screen.getByText("Suscripciones"));
    fireEvent.click(screen.getByText("Ocio"));
    fireEvent.click(screen.getByRole("button", { name: "Simular 2 categorías" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("No se pudo crear ninguna simulación.");
    });
  });

  // ── Desenlace (c): fallo parcial ────────────────────────────────────────────

  it("fallo parcial (1 de 2): toast warning, caja de resumen, creada destildada+deshabilitada con 'Simulación creada.', fallida sigue tildada con su error", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [{ id: "sim-1", categoryId: "cat-1" }],
      failed: [{ categoryId: "cat-4", message: "Ya tenés una simulación activa para esta categoría" }],
    });
    renderModal();

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

    // Suscripciones (creada): destildada, deshabilitada, desenlace "Simulación creada.".
    const createdRow = getRow("Suscripciones");
    expect(createdRow).toHaveAttribute("aria-checked", "false");
    expect(createdRow).toHaveAttribute("aria-disabled", "true");
    expect(createdRow.textContent).toContain("Simulación creada.");
    expect(createdRow.textContent).not.toContain("Ya la estás simulando");

    // Ocio (fallida): sigue tildada, con su error.
    const failedRow = getRow("Ocio");
    expect(failedRow).toHaveAttribute("aria-checked", "true");
    expect(failedRow).not.toHaveAttribute("aria-disabled");
    expect(screen.getByText("Ya tenés una simulación activa para esta categoría")).toBeInTheDocument();

    // NINGUNA fila desaparece de la lista mientras el modal está abierto.
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();

    // El botón ya dice "Simular 1 categoría" — listo para reintentar de un clic.
    expect(screen.getByRole("button", { name: "Simular 1 categoría" })).toBeInTheDocument();
  });

  it("destildar una fila fallida limpia su mensaje de error", async () => {
    mockCreateSimulation.mockResolvedValue({
      created: [],
      failed: [{ categoryId: "cat-1", message: "Ya tenés una simulación activa para esta categoría" }],
    });
    renderModal();

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
    renderModal();

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
