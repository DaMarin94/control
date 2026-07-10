/**
 * Tests de `useScrollShadow` + `getScrollShadowStyle` — affordance de corte
 * de las superficies con scroll horizontal interno (docs/design.md
 * §"Superficies con scroll interno" → "Affordance de 'hay más'"). Usado por
 * `unique-grid-card` y `cuotas-gantt-card`.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useScrollShadow, getScrollShadowStyle } from "@/hooks/use-scroll-shadow";

function TestHarness({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const shadow = useScrollShadow(ref);

  return (
    <div
      data-testid="scroller"
      ref={(el) => {
        ref.current = el;
        if (el) {
          Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
          Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
        }
      }}
    >
      <span data-testid="left">{String(shadow.showLeft)}</span>
      <span data-testid="right">{String(shadow.showRight)}</span>
    </div>
  );
}

describe("useScrollShadow", () => {
  it("sin overflow (scrollWidth === clientWidth): nunca muestra sombra", () => {
    render(<TestHarness scrollWidth={500} clientWidth={500} />);

    expect(screen.getByTestId("left")).toHaveTextContent("false");
    expect(screen.getByTestId("right")).toHaveTextContent("false");
  });

  it("con overflow, en el extremo izquierdo (scrollLeft=0): solo showRight", () => {
    render(<TestHarness scrollWidth={1000} clientWidth={500} />);

    expect(screen.getByTestId("left")).toHaveTextContent("false");
    expect(screen.getByTestId("right")).toHaveTextContent("true");
  });

  it("scrolleado al medio: showLeft y showRight, ambos true", () => {
    render(<TestHarness scrollWidth={1000} clientWidth={500} />);

    const scroller = screen.getByTestId("scroller");
    Object.defineProperty(scroller, "scrollLeft", { value: 250, configurable: true });
    fireEvent.scroll(scroller);

    expect(screen.getByTestId("left")).toHaveTextContent("true");
    expect(screen.getByTestId("right")).toHaveTextContent("true");
  });

  it("scrolleado al extremo derecho (scrollLeft === maxScroll): solo showLeft", () => {
    render(<TestHarness scrollWidth={1000} clientWidth={500} />);

    const scroller = screen.getByTestId("scroller");
    Object.defineProperty(scroller, "scrollLeft", { value: 500, configurable: true });
    fireEvent.scroll(scroller);

    expect(screen.getByTestId("left")).toHaveTextContent("true");
    expect(screen.getByTestId("right")).toHaveTextContent("false");
  });
});

describe("getScrollShadowStyle", () => {
  it("sin sombra en ningún lado → undefined (sin box-shadow)", () => {
    expect(getScrollShadowStyle({ showLeft: false, showRight: false }, false)).toBeUndefined();
  });

  it("showRight (claro) → inset -14px de borde derecho con el color claro", () => {
    const style = getScrollShadowStyle({ showLeft: false, showRight: true }, false);
    expect(style).toBe("inset -14px 0 12px -12px oklch(0.18 0.02 270 / 0.18)");
  });

  it("showLeft (oscuro) → inset 14px de borde izquierdo con el color oscuro", () => {
    const style = getScrollShadowStyle({ showLeft: true, showRight: false }, true);
    expect(style).toBe("inset 14px 0 12px -12px oklch(0 0 0 / 0.4)");
  });

  it("ambos lados combinan las dos sombras (derecho primero, izquierdo después)", () => {
    const style = getScrollShadowStyle({ showLeft: true, showRight: true }, false);
    expect(style).toBe(
      "inset -14px 0 12px -12px oklch(0.18 0.02 270 / 0.18), inset 14px 0 12px -12px oklch(0.18 0.02 270 / 0.18)",
    );
  });
});
