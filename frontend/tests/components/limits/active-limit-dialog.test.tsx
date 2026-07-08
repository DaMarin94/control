/**
 * Tests del aviso de alerta activa de límites (P2 — Fase 2, docs/design.md
 * §"Aviso de alerta activa de límites").
 *
 * Cubre:
 * - role="alertdialog" + foco inicial en "Cancelar" (D11/a11y).
 * - Título singular/plural según cantidad de cruces (D18).
 * - Enumera TODOS los límites cruzados, con label/placeholder + condición.
 * - "Cancelar" invoca onCancel; "Guardar igual" invoca onConfirm.
 * - Esc invoca onCancel.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import type { LimitConfig } from "@/types/limit";

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: "l1",
    enabled: true,
    anchorKey: "mes.total.gasto",
    operator: "gt",
    threshold: 300000,
    nature: "active",
    ...overrides,
  };
}

describe("ActiveLimitDialog", () => {
  it("usa role='alertdialog' y arranca con foco en 'Cancelar'", async () => {
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancelar/i })).toHaveFocus();
    });
  });

  it("título singular con 1 límite cruzado", () => {
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Este movimiento cruza un límite")).toBeInTheDocument();
  });

  it("título plural con N límites cruzados", () => {
    render(
      <ActiveLimitDialog
        crossed={[makeLimit({ id: "l1" }), makeLimit({ id: "l2" })]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Este movimiento cruza 2 límites")).toBeInTheDocument();
  });

  it("enumera el label del límite (o el placeholder derivado si no tiene label)", () => {
    render(
      <ActiveLimitDialog
        crossed={[makeLimit({ label: "Mi límite de gasto" })]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Mi límite de gasto")).toBeInTheDocument();
  });

  it("deriva el placeholder (key legible + condición) cuando el límite no tiene label", () => {
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Gasto del mes")).toBeInTheDocument();
  });

  it("muestra el verbo derivado del operador y el umbral en mono", () => {
    render(
      <ActiveLimitDialog
        crossed={[makeLimit({ operator: "gt", threshold: 300000 })]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/supera/i)).toBeInTheDocument();
    expect(screen.getByText("300.000")).toBeInTheDocument();
  });

  it("'Cancelar' invoca onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={onCancel} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("'Guardar igual' invoca onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /guardar igual/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Esc invoca onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ActiveLimitDialog crossed={[makeLimit()]} onCancel={onCancel} onConfirm={vi.fn()} />);

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita los botones mientras isConfirming=true", () => {
    render(
      <ActiveLimitDialog crossed={[makeLimit()]} onCancel={vi.fn()} onConfirm={vi.fn()} isConfirming />,
    );
    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
  });
});
