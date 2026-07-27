/**
 * Tests de KebabMenu (docs/design.md §"Duplicar movimiento" — corrección del
 * flip). El panel decide abrir hacia arriba comparando el espacio disponible
 * debajo del trigger contra una altura estimada. Esa estimación DEBE derivarse
 * del número real de ítems (`items.length`) — antes del fix era una constante
 * fija (120px) que quedaba corta con 5 ítems (~173px reales) y el panel abierto
 * en el pie del listado se cortaba contra el viewport.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KebabMenu, type KebabMenuItem } from "@/components/ui/kebab-menu";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

function stubTriggerRect(el: HTMLElement, bottom: number, top: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON() {},
    }) as DOMRect;
}

function itemsOf(count: number): KebabMenuItem[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `Ítem ${i + 1}`,
    onSelect: vi.fn(),
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("KebabMenu — flip vertical según cantidad de ítems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("con 5 ítems y ~150px libres debajo, abre hacia ARRIBA (real ≈173px no entraría abajo)", () => {
    setViewportHeight(700);
    render(<KebabMenu ariaLabel="Acciones" items={itemsOf(5)} />);

    const trigger = screen.getByRole("button", { name: "Acciones" });
    // bottom = 550 → espacio libre debajo = 700 − 550 = 150px
    stubTriggerRect(trigger, 550, 520);
    fireEvent.click(trigger);

    const panel = screen.getByRole("menu", { name: "Acciones" });
    // Al abrir hacia arriba, el panel se ancla por "bottom" (no por "top").
    expect(panel.style.top).toBe("");
    expect(panel.style.bottom).not.toBe("");
  });

  it("con 3 ítems y el mismo ~150px libres debajo, abre hacia ABAJO (real ≈107px sí entra)", () => {
    setViewportHeight(700);
    render(<KebabMenu ariaLabel="Acciones" items={itemsOf(3)} />);

    const trigger = screen.getByRole("button", { name: "Acciones" });
    stubTriggerRect(trigger, 550, 520);
    fireEvent.click(trigger);

    const panel = screen.getByRole("menu", { name: "Acciones" });
    expect(panel.style.bottom).toBe("");
    expect(panel.style.top).not.toBe("");
  });

  it("con 5 ítems y espacio abundante debajo, abre hacia ABAJO", () => {
    setViewportHeight(1200);
    render(<KebabMenu ariaLabel="Acciones" items={itemsOf(5)} />);

    const trigger = screen.getByRole("button", { name: "Acciones" });
    // bottom = 200 → espacio libre debajo = 1000px, sobra para 5 ítems (~173px)
    stubTriggerRect(trigger, 200, 170);
    fireEvent.click(trigger);

    const panel = screen.getByRole("menu", { name: "Acciones" });
    expect(panel.style.bottom).toBe("");
    expect(panel.style.top).not.toBe("");
  });

  it("con 5 ítems en la última fila de un listado (viewport bajo), el panel entra entero (abre hacia arriba)", () => {
    // Simula el escenario del checklist visual: viewport bajo (~700px) y el
    // trigger pegado al borde inferior — el menú de 5 ítems debe abrir arriba.
    setViewportHeight(700);
    render(<KebabMenu ariaLabel="Acciones de la última fila" items={itemsOf(5)} />);

    const trigger = screen.getByRole("button", { name: "Acciones de la última fila" });
    stubTriggerRect(trigger, 690, 660); // pegado al fondo del viewport
    fireEvent.click(trigger);

    const panel = screen.getByRole("menu", { name: "Acciones de la última fila" });
    expect(panel.style.top).toBe("");
    expect(panel.style.bottom).not.toBe("");
    // Los 5 ítems siguen siendo clickeables (todos presentes en el DOM)
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  });
});

describe("KebabMenu — render básico", () => {
  it("el trigger abre el panel con todos los ítems provistos", () => {
    setViewportHeight(800);
    render(<KebabMenu ariaLabel="Acciones" items={itemsOf(4)} />);

    const trigger = screen.getByRole("button", { name: "Acciones" });
    stubTriggerRect(trigger, 100, 70);
    fireEvent.click(trigger);

    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });

  it("click en un ítem llama a su onSelect y cierra el panel", () => {
    setViewportHeight(800);
    const items = itemsOf(2);
    render(<KebabMenu ariaLabel="Acciones" items={items} />);

    const trigger = screen.getByRole("button", { name: "Acciones" });
    stubTriggerRect(trigger, 100, 70);
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "Ítem 1" }));

    expect(items[0].onSelect).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
