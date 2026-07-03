/**
 * Tests de PaymentMethodIcon — mapeo de clave → glifo (genéricos lucide + marcas
 * simple-icons), con fallback a "card" para claves fuera del set curado.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { PAYMENT_METHOD_ICON_KEYS } from "@/types/payment-method";

describe("PaymentMethodIcon", () => {
  it("renderiza sin romper para las 12 claves del set curado", () => {
    for (const key of PAYMENT_METHOD_ICON_KEYS) {
      const { container, unmount } = render(<PaymentMethodIcon icon={key} />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    }
  });

  it("una marca desconocida cae al ícono 'card' (fallback)", () => {
    const { container: fallback } = render(<PaymentMethodIcon icon="unknown-brand" />);
    const { container: card } = render(<PaymentMethodIcon icon="card" />);

    // Ambos deben renderizar el mismo glifo (CreditCard de lucide)
    expect(fallback.querySelector("svg")?.outerHTML).toBe(card.querySelector("svg")?.outerHTML);
  });

  it("renderiza las marcas (simple-icons) como <path> con fill currentColor", () => {
    const { container } = render(<PaymentMethodIcon icon="visa" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg?.querySelector("path")).toBeInTheDocument();
  });

  it("aplica el tamaño solicitado", () => {
    const { container } = render(<PaymentMethodIcon icon="cash" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });
});
