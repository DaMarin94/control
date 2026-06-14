/**
 * Tests de la primitiva Button.
 * Actualizados en Fase 2 para reflejar los tokens del design system "Precise Ledger".
 *
 * Las clases de shadcn (bg-primary, bg-destructive, border-input, h-8, h-10)
 * fueron reemplazadas por los tokens del DS (bg-accent, bg-expense-soft,
 * border-line-strong, py-[7px], py-[13px]).
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

  it("aplica variante default por defecto (bg-accent)", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-accent");
    expect(btn).toHaveClass("text-white");
  });

  it("aplica variante outline (borde line-strong, bg-panel)", () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border");
    expect(btn).toHaveClass("border-line-strong");
    expect(btn).toHaveClass("bg-panel");
  });

  it("aplica variante ghost (bg-panel, borde line)", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-panel");
    expect(btn).toHaveClass("border-line");
    expect(btn).toHaveClass("text-ink");
  });

  it("aplica variante destructive (expense-soft, expense-ink)", () => {
    render(<Button variant="destructive">Eliminar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-expense-soft");
    expect(btn).toHaveClass("text-expense-ink");
  });

  it("aplica tamaño sm (py-[7px])", () => {
    render(<Button size="sm">Pequeño</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("py-[7px]");
    expect(btn).toHaveClass("px-3");
  });

  it("aplica tamaño lg (py-[13px])", () => {
    render(<Button size="lg">Grande</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("py-[13px]");
    expect(btn).toHaveClass("px-5");
  });

  it("aplica tamaño default (py-[10px] px-4)", () => {
    render(<Button>Default size</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("py-[10px]");
    expect(btn).toHaveClass("px-4");
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
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
  });

  it("aplica rounded-ctl (radio del design system)", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-ctl");
  });

  it("aplica transición de 140ms", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("duration-[140ms]");
  });
});
