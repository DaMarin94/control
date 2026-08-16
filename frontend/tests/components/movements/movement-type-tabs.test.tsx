/**
 * Tests de MovementTypeTabs — tabs del modal de ESCRITORIO
 * (docs/design.md §Superficie de captura → "0. Encuadre — una lógica, dos
 * composiciones"). La superficie de captura tiene su propia composición
 * hermana (`CaptureMovementTypeTabs`, components/capture/) con su propia
 * densidad — no se testea acá.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MovementTypeTabs } from "@/components/movements/movement-type-tabs";

describe("MovementTypeTabs", () => {
  it("renderiza los tres tabs en orden Único / Fijo / Cuotas", () => {
    render(<MovementTypeTabs activeTab="single" onTabChange={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Único", "Fijo", "Cuotas"]);
  });

  it("marca aria-selected=true solo en el tab activo", () => {
    render(<MovementTypeTabs activeTab="fixed" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Único" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Fijo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Cuotas" })).toHaveAttribute("aria-selected", "false");
  });

  it("cada tab tiene un id estable `tab-<id>` (hook de a11y para aria-labelledby de los tabpanels)", () => {
    render(<MovementTypeTabs activeTab="single" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Único" })).toHaveAttribute("id", "tab-single");
    expect(screen.getByRole("tab", { name: "Fijo" })).toHaveAttribute("id", "tab-fixed");
    expect(screen.getByRole("tab", { name: "Cuotas" })).toHaveAttribute("id", "tab-installments");
  });

  it("clickear un tab llama a onTabChange con el id correspondiente", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<MovementTypeTabs activeTab="single" onTabChange={onTabChange} />);

    await user.click(screen.getByRole("tab", { name: "Cuotas" }));
    expect(onTabChange).toHaveBeenCalledWith("installments");
  });
});
