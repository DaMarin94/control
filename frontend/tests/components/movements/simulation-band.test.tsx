/**
 * Tests de SimulationBand (docs/design.md "Simulación de categoría (`/mes`)"
 * §2/§4/§6.1, RF-SIM-001/004).
 * Verifica:
 * - El botón "Simular categoría" está SIEMPRE presente (punto de entrada único).
 * - Sin simulaciones activas: copy "Proyecta categorías desde el mes que estás viendo."
 *   y NO se muestra la nota general.
 * - Con ≥1 activa: lista con punto de color + nombre + botón eliminar, y la
 *   nota general "Cada simulación proyecta desde el mes en que la creaste." al pie.
 * - EL TRAMO ES POR FILA (§0, cambio 1): cada simulación activa muestra su
 *   propio tramo en una segunda línea — variante corta si ya arrancó, larga
 *   si todavía no.
 * - Simulación pausada: chip "Sin datos", nombre atenuado, segunda línea con
 *   el motivo de pausa (NO el tramo) — y el botón eliminar SIGUE disponible.
 * - onOpenCreate / onRequestDelete se invocan correctamente.
 * - EXTENDER EL TRAMO (§4.1): el disparador aparece SOLO en la fila cuyo
 *   `endMonth` es el mes VISUALIZADO (no el mes en curso), revela las cuatro
 *   opciones, nunca hay dos filas eligiendo, y el desenlace (éxito/error)
 *   sigue lo especificado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SimulationBand } from "@/components/movements/simulation-band";
import type { SimulationDto } from "@/types/simulation";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-simulations", () => ({
  useExtendSimulation: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() },
  })),
}));

import { useExtendSimulation } from "@/hooks/use-simulations";

const mockUseExtendSimulation = vi.mocked(useExtendSimulation);
const mockExtendSimulation = vi.fn();

const CURRENT_MONTH = "2026-06";
/**
 * Mes VISUALIZADO por default en estos tests — distinto del `endMonth` de las
 * simulaciones de abajo, así que el disparador de extender NO aparece salvo
 * que un test lo pida explícitamente.
 */
const VIEWED_MONTH = "2026-06";

const activeSimulation: SimulationDto = {
  id: "sim-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Suscripciones", color: "#3B7DE0", scope: "BOTH" },
  monthsWithData: 6,
  paused: false,
  startMonth: "2026-06",
  effectiveStartMonth: "2026-06",
  endMonth: "2026-12",
  createdAt: "2026-06-01T12:00:00.000Z",
};

// Creada parada en un mes FUTURO — todavía no arrancó (§4, variante larga).
const notYetStartedSimulation: SimulationDto = {
  id: "sim-3",
  categoryId: "cat-3",
  category: { id: "cat-3", name: "Regalos", color: "#7A5FD1", scope: "EXPENSE" },
  monthsWithData: 5,
  paused: false,
  startMonth: "2026-10",
  effectiveStartMonth: "2026-10",
  endMonth: "2027-04",
  createdAt: "2026-06-15T12:00:00.000Z",
};

const pausedSimulation: SimulationDto = {
  id: "sim-2",
  categoryId: "cat-2",
  category: { id: "cat-2", name: "Viajes", color: "#E23B3B", scope: "EXPENSE" },
  monthsWithData: 1,
  paused: true,
  startMonth: "2026-05",
  effectiveStartMonth: "2026-06",
  endMonth: "2026-12",
  createdAt: "2026-05-01T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseExtendSimulation.mockReturnValue({
    extendSimulation: mockExtendSimulation,
    isExtending: false,
  });
  mockExtendSimulation.mockResolvedValue({ success: true });
});

describe("SimulationBand", () => {
  it("el botón 'Simular categoría' está presente incluso sin simulaciones activas (cero-impacto)", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /simular categoría/i })).toBeInTheDocument();
  });

  it("sin activas: muestra la línea 'Proyecta categorías desde el mes que estás viendo.' y sin nota general", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Proyecta categorías desde el mes que estás viendo.")).toBeInTheDocument();
    expect(screen.queryByText(/cada simulación proyecta/i)).not.toBeInTheDocument();
  });

  it("clic en 'Simular categoría' llama a onOpenCreate", () => {
    const onOpenCreate = vi.fn();
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[]}
        onOpenCreate={onOpenCreate}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /simular categoría/i }));
    expect(onOpenCreate).toHaveBeenCalledTimes(1);
  });

  it("con ≥1 activa: lista la simulación y muestra la nota general (constante, sin mes)", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(
      screen.getByText("Cada simulación proyecta desde el mes en que la creaste."),
    ).toBeInTheDocument();
  });

  it("simulación YA ARRANCADA: tramo por fila en variante corta ('Proyecta hasta {mes} {año}.')", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Proyecta hasta diciembre 2026.")).toBeInTheDocument();
  });

  it("simulación TODAVÍA NO ARRANCADA: tramo por fila en variante larga ('Proyecta de {mes} {año} a {mes} {año}.')", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[notYetStartedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Proyecta de octubre 2026 a abril 2027.")).toBeInTheDocument();
  });

  it("dos simulaciones con anclas distintas: cada fila muestra SU PROPIO tramo, sin que ninguna nota las contradiga", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation, notYetStartedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Proyecta hasta diciembre 2026.")).toBeInTheDocument();
    expect(screen.getByText("Proyecta de octubre 2026 a abril 2027.")).toBeInTheDocument();
  });

  it("botón eliminar de una fila llama a onRequestDelete con esa simulación", () => {
    const onRequestDelete = vi.fn();
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /eliminar la simulación de suscripciones/i }));
    expect(onRequestDelete).toHaveBeenCalledWith(activeSimulation);
  });

  it("simulación pausada: chip 'Sin datos', motivo de pausa visible, SIN tramo, y botón eliminar disponible", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[pausedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByText(/necesita 3 meses con datos \(tiene 1\)\. no proyecta\./i)).toBeInTheDocument();
    expect(screen.queryByText(/^proyecta hasta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^proyecta de /i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar la simulación de viajes/i })).toBeEnabled();
  });

  it("mezcla activa + pausada: ambas aparecen en la lista", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation, pausedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(screen.getByText("Viajes")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

// ─── Extender el tramo (§4.1) ─────────────────────────────────────────────────

/** El `endMonth` de `activeSimulation` / `pausedSimulation`. */
const END_MONTH = "2026-12";

describe("SimulationBand — extender el tramo (§4.1)", () => {
  it("NO muestra el disparador cuando el mes visualizado no es el endMonth de la simulación", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={VIEWED_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Extender" })).not.toBeInTheDocument();
  });

  it("muestra el disparador SOLO en la fila cuyo endMonth es el mes visualizado", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation, notYetStartedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Extender" })).toHaveLength(1);
    // La oración del tramo se conserva entera, con el link agregado al final.
    expect(screen.getByText(/proyecta hasta diciembre 2026\./i)).toBeInTheDocument();
  });

  it("una simulación PAUSADA también ofrece extender, conservando la nota de pausa", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[pausedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/necesita 3 meses con datos \(tiene 1\)\. no proyecta\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extender" })).toBeInTheDocument();
  });

  it("clic en 'Extender' revela las cuatro opciones y oculta el tramo", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Extender" }));
    expect(screen.getByRole("button", { name: "Extender 1 mes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extender 3 meses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extender 6 meses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extender 12 meses" })).toBeInTheDocument();
    expect(screen.queryByText(/proyecta hasta diciembre 2026\./i)).not.toBeInTheDocument();
  });

  it("Escape colapsa la elección y vuelve al disparador", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Extender" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Extender 1 mes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extender" })).toBeInTheDocument();
  });

  it("elegir un valor dispara la extensión con esos meses y avisa con toast de éxito", async () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Extender" }));
    fireEvent.click(screen.getByRole("button", { name: "Extender 3 meses" }));
    await waitFor(() => expect(mockExtendSimulation).toHaveBeenCalledWith("sim-1", 3));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Simulación extendida."));
  });

  it("error: toast.error y la línea vuelve a las cuatro opciones (no al disparador)", async () => {
    mockExtendSimulation.mockResolvedValue({
      success: false,
      error: "No se pudo extender la simulación. Intentá de nuevo.",
    });
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Extender" }));
    fireEvent.click(screen.getByRole("button", { name: "Extender 1 mes" }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("No se pudo extender la simulación. Intentá de nuevo."),
    );
    expect(screen.getByRole("button", { name: "Extender 1 mes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extender" })).not.toBeInTheDocument();
  });

  it("en vuelo: 'Extendiendo…' y el botón eliminar de ESA fila deshabilitado", async () => {
    let resolveExtend: (value: { success: boolean }) => void = () => {};
    mockExtendSimulation.mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveExtend = resolve;
      }),
    );
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
        viewedMonth={END_MONTH}
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Extender" }));
    fireEvent.click(screen.getByRole("button", { name: "Extender 6 meses" }));
    await waitFor(() => expect(screen.getByText("Extendiendo…")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: /eliminar la simulación de suscripciones/i }),
    ).toBeDisabled();
    resolveExtend({ success: true });
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
  });
});
