/**
 * Tests del componente PeriodNav (Fase 1.1.3, revisado 1.2.0).
 *
 * Verifica:
 * - Renderiza el contenido hijo.
 * - Botón "anterior" dispara onPrev; botón "siguiente" dispara onNext.
 * - canGoPrev=false → botón prev aria-disabled, no dispara onPrev.
 * - canGoNext=false → botón next aria-disabled, no dispara onNext.
 * - Los aria-labels se asignan correctamente.
 *
 * Nota Fase 1.2.0 (spec canónica): las flechas se centran al VIEWPORT con
 * sticky top-[50vh] -translate-y-1/2. Las celdas laterales llevan
 * min-height:100vh para que el sticky tenga recorrido también con listas cortas.
 * El comportamiento funcional (handlers, disabled) no cambia.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodNav } from "@/components/ui/period-nav";

function renderPeriodNav(overrides?: Partial<React.ComponentProps<typeof PeriodNav>>) {
  const defaults = {
    prevLabel: "Mes anterior",
    nextLabel: "Mes siguiente",
    onPrev: vi.fn(),
    onNext: vi.fn(),
    canGoPrev: true,
    canGoNext: true,
    children: <div data-testid="content">Contenido del período</div>,
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<PeriodNav {...props} />), props };
}

describe("PeriodNav", () => {
  // ── Renderizado básico ──────────────────────────────────────────────────────

  it("renderiza el contenido hijo", () => {
    renderPeriodNav();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renderiza el botón anterior con el aria-label correcto", () => {
    renderPeriodNav({ prevLabel: "Mes anterior" });
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeInTheDocument();
  });

  it("renderiza el botón siguiente con el aria-label correcto", () => {
    renderPeriodNav({ nextLabel: "Mes siguiente" });
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeInTheDocument();
  });

  it("soporta labels de año para reutilización en Fase 1.1.5", () => {
    renderPeriodNav({ prevLabel: "Año anterior", nextLabel: "Año siguiente" });
    expect(screen.getByRole("button", { name: "Año anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Año siguiente" })).toBeInTheDocument();
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  it("click en el botón anterior dispara onPrev", () => {
    const onPrev = vi.fn();
    renderPeriodNav({ onPrev });
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("click en el botón siguiente dispara onNext", () => {
    const onNext = vi.fn();
    renderPeriodNav({ onNext });
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // ── Estado disabled ────────────────────────────────────────────────────────

  it("canGoPrev=false → botón anterior tiene aria-disabled=true", () => {
    renderPeriodNav({ canGoPrev: false });
    const btn = screen.getByRole("button", { name: "Mes anterior" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("canGoNext=false → botón siguiente tiene aria-disabled=true", () => {
    renderPeriodNav({ canGoNext: false });
    const btn = screen.getByRole("button", { name: "Mes siguiente" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("canGoPrev=false → click en botón anterior NO dispara onPrev", () => {
    const onPrev = vi.fn();
    renderPeriodNav({ canGoPrev: false, onPrev });
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("canGoNext=false → click en botón siguiente NO dispara onNext", () => {
    const onNext = vi.fn();
    renderPeriodNav({ canGoNext: false, onNext });
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("canGoPrev=true → botón anterior NO tiene aria-disabled", () => {
    renderPeriodNav({ canGoPrev: true });
    const btn = screen.getByRole("button", { name: "Mes anterior" });
    expect(btn).toHaveAttribute("aria-disabled", "false");
  });

  it("canGoNext=true → botón siguiente NO tiene aria-disabled", () => {
    renderPeriodNav({ canGoNext: true });
    const btn = screen.getByRole("button", { name: "Mes siguiente" });
    expect(btn).toHaveAttribute("aria-disabled", "false");
  });

  // ── Defaults ───────────────────────────────────────────────────────────────

  it("canGoPrev y canGoNext default a true cuando no se pasan", () => {
    render(
      <PeriodNav
        prevLabel="Mes anterior"
        nextLabel="Mes siguiente"
        onPrev={vi.fn()}
        onNext={vi.fn()}
      >
        <div>contenido</div>
      </PeriodNav>,
    );
    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });
});
