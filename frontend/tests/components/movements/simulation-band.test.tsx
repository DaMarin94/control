/**
 * Tests de SimulationBand (docs/design.md "Simulación de categoría (`/mes`)"
 * §2/§4/§6.1, RF-SIM-001/004).
 * Verifica:
 * - El botón "Simular categoría" está SIEMPRE presente (punto de entrada único).
 * - Sin simulaciones activas: copy "Proyecta una categoría a los meses futuros."
 *   y NO se muestra la nota de horizonte.
 * - Con ≥1 activa: lista con punto de color + nombre + botón eliminar, y la
 *   nota "Se proyecta hasta {mes} {año}." al pie.
 * - Simulación pausada: chip "Sin datos", nombre atenuado, segunda línea con
 *   el motivo — y el botón eliminar SIGUE disponible.
 * - onOpenCreate / onRequestDelete se invocan correctamente.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimulationBand } from "@/components/movements/simulation-band";
import type { SimulationDto } from "@/types/simulation";

const activeSimulation: SimulationDto = {
  id: "sim-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Suscripciones", color: "#3B7DE0", scope: "BOTH" },
  monthsWithData: 6,
  paused: false,
  createdAt: "2026-06-01T12:00:00.000Z",
};

const pausedSimulation: SimulationDto = {
  id: "sim-2",
  categoryId: "cat-2",
  category: { id: "cat-2", name: "Viajes", color: "#E23B3B", scope: "EXPENSE" },
  monthsWithData: 1,
  paused: true,
  createdAt: "2026-05-01T12:00:00.000Z",
};

describe("SimulationBand", () => {
  it("el botón 'Simular categoría' está presente incluso sin simulaciones activas (cero-impacto)", () => {
    render(
      <SimulationBand
        horizonEndMonth={null}
        simulations={[]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /simular categoría/i })).toBeInTheDocument();
  });

  it("sin activas: muestra la línea 'Proyecta una categoría a los meses futuros.' y sin nota de horizonte", () => {
    render(
      <SimulationBand
        horizonEndMonth="2026-12"
        simulations={[]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Proyecta una categoría a los meses futuros.")).toBeInTheDocument();
    expect(screen.queryByText(/se proyecta hasta/i)).not.toBeInTheDocument();
  });

  it("clic en 'Simular categoría' llama a onOpenCreate", () => {
    const onOpenCreate = vi.fn();
    render(
      <SimulationBand
        horizonEndMonth={null}
        simulations={[]}
        onOpenCreate={onOpenCreate}
        onRequestDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /simular categoría/i }));
    expect(onOpenCreate).toHaveBeenCalledTimes(1);
  });

  it("con ≥1 activa: lista la simulación y muestra la nota de horizonte", () => {
    render(
      <SimulationBand
        horizonEndMonth="2026-12"
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Suscripciones")).toBeInTheDocument();
    expect(screen.getByText("Se proyecta hasta diciembre 2026.")).toBeInTheDocument();
  });

  it("botón eliminar de una fila llama a onRequestDelete con esa simulación", () => {
    const onRequestDelete = vi.fn();
    render(
      <SimulationBand
        horizonEndMonth="2026-12"
        simulations={[activeSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /eliminar la simulación de suscripciones/i }));
    expect(onRequestDelete).toHaveBeenCalledWith(activeSimulation);
  });

  it("simulación pausada: chip 'Sin datos', motivo visible y botón eliminar disponible", () => {
    render(
      <SimulationBand
        horizonEndMonth="2026-12"
        simulations={[pausedSimulation]}
        onOpenCreate={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByText(/necesita 3 meses con datos \(tiene 1\)\. no proyecta\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar la simulación de viajes/i })).toBeEnabled();
  });

  it("mezcla activa + pausada: ambas aparecen en la lista", () => {
    render(
      <SimulationBand
        horizonEndMonth="2026-12"
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
