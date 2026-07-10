/**
 * Tests del ViewportGate (RF-APP-002 — gate por debajo del ancho mínimo
 * soportado).
 *
 * El gate es CSS puro (sin listener de resize, sin estado, sin chequeo de
 * `window`): no hay comportamiento dinámico que testear. Lo testeable es
 * markup estático:
 * - El copy exacto de RF-APP-002 (título + línea).
 * - Que el elemento raíz lleva las clases del breakpoint correctas
 *   (oculto por default, visible solo por debajo del piso vía `max-floor:`).
 * - Que es una pantalla sin controles (sin botones/links — "continuar
 *   igual" no existe).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewportGate } from "@/components/layout/viewport-gate";

describe("ViewportGate", () => {
  it("renderiza el título exacto de RF-APP-002", () => {
    render(<ViewportGate />);

    expect(
      screen.getByRole("heading", { name: "Necesitás una pantalla más grande" }),
    ).toBeInTheDocument();
  });

  it("renderiza la línea de copy exacta de RF-APP-002", () => {
    render(<ViewportGate />);

    expect(
      screen.getByText(
        "Control necesita más espacio para mostrarte tus movimientos con claridad. Agrandá la ventana o abrilo en una pantalla más grande.",
      ),
    ).toBeInTheDocument();
  });

  it("el elemento raíz lleva las clases del breakpoint (oculto por default, visible bajo el piso)", () => {
    const { container } = render(<ViewportGate />);
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root).toHaveClass("hidden");
    expect(root).toHaveClass("max-floor:visible");
    expect(root).toHaveClass("max-floor:flex");
  });

  it("es un bloqueo, no un aviso: no expone ningún control (botón/link) de 'continuar igual'", () => {
    render(<ViewportGate />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
