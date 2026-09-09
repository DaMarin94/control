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
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimulationBand } from "@/components/movements/simulation-band";
import type { SimulationDto } from "@/types/simulation";

const CURRENT_MONTH = "2026-06";

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

describe("SimulationBand", () => {
  it("el botón 'Simular categoría' está presente incluso sin simulaciones activas (cero-impacto)", () => {
    render(
      <SimulationBand
        currentMonth={CURRENT_MONTH}
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
