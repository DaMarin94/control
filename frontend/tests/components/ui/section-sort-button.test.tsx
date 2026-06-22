/**
 * Tests del componente SectionSortButton (Ola 2, Sub-fase C).
 *
 * Verifica:
 * - Renderiza el ícono correcto según el orden activo.
 * - aria-pressed refleja el estado ("date" = true, "amount" = false).
 * - aria-label dinámico anuncia la PRÓXIMA acción.
 * - Punto indicador visible solo cuando sort === "date" (no-default).
 * - El clic llama onToggle.
 * - stopPropagation: el clic no burbujea al contenedor padre.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionSortButton } from "@/components/ui/section-sort-button";

function renderBtn(sort: "amount" | "date", onToggle = vi.fn()) {
  return render(<SectionSortButton sort={sort} onToggle={onToggle} />);
}

describe("SectionSortButton", () => {
  // ── aria-label dinámico ───────────────────────────────────────────────────────

  it("aria-label = 'Ordenar por fecha' cuando sort === 'amount' (anuncia próxima acción)", () => {
    renderBtn("amount");
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Ordenar por fecha");
  });

  it("aria-label = 'Ordenar por monto' cuando sort === 'date' (anuncia próxima acción)", () => {
    renderBtn("date");
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Ordenar por monto");
  });

  // ── aria-pressed ─────────────────────────────────────────────────────────────

  it("aria-pressed=false cuando sort === 'amount' (estado default)", () => {
    renderBtn("amount");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("aria-pressed=true cuando sort === 'date' (estado no-default)", () => {
    renderBtn("date");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  // ── Punto indicador ──────────────────────────────────────────────────────────

  it("NO muestra punto indicador cuando sort === 'amount' (default)", () => {
    const { container } = renderBtn("amount");
    // El punto es un <span> con clase bg-accent; en modo default no debe existir
    const dot = container.querySelector(".bg-accent");
    expect(dot).toBeNull();
  });

  it("muestra punto indicador cuando sort === 'date' (no-default)", () => {
    const { container } = renderBtn("date");
    const dot = container.querySelector(".bg-accent");
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  // ── Interacción ──────────────────────────────────────────────────────────────

  it("llama onToggle al hacer clic", () => {
    const onToggle = vi.fn();
    renderBtn("amount", onToggle);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("llama onToggle también desde el estado 'date'", () => {
    const onToggle = vi.fn();
    renderBtn("date", onToggle);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("stopPropagation: el clic no burbujea al contenedor padre", () => {
    const parentHandler = vi.fn();
    render(
      <div onClick={parentHandler}>
        <SectionSortButton sort="amount" onToggle={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(parentHandler).not.toHaveBeenCalled();
  });

  // ── Tipo de botón ─────────────────────────────────────────────────────────────

  it("es un botón de tipo 'button' (no submit)", () => {
    renderBtn("amount");
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
