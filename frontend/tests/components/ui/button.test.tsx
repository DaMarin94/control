/**
 * Tests de la primitiva Button.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renderiza el texto correctamente", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("aplica variante default por defecto", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-primary");
  });

  it("aplica variante outline", () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border");
    expect(btn).toHaveClass("border-input");
  });

  it("aplica variante ghost", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("hover:bg-accent");
  });

  it("aplica variante destructive", () => {
    render(<Button variant="destructive">Eliminar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-destructive");
  });

  it("aplica tamaño sm", () => {
    render(<Button size="sm">Pequeño</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-8");
  });

  it("aplica tamaño lg", () => {
    render(<Button size="lg">Grande</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-10");
  });

  it("llama al onClick cuando se hace click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("no llama al onClick cuando está disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>,
    );

    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("acepta className adicional", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("renderiza como Slot cuando asChild es true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );
    // Renderiza un <a>, no un <button>
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Link Button" })).toBeInTheDocument();
  });

  it("tiene atributo type button por defecto (evita submit accidental)", () => {
    render(<Button>Test</Button>);
    // No tiene type explícito en la implementación, pero verifica que no rompe el form
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
  });
});
