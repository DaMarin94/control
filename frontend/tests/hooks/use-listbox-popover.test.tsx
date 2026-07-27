/**
 * Tests de `useListboxPosition` + `useListboxDismiss` — posicionamiento
 * (flip vertical) y cierre de los listbox/popover portaleados a
 * `document.body` (docs/design.md §"Posicionamiento de popovers/listbox por
 * portal — flip vertical y comportamiento ante scroll"). Fix del bug E1:
 * flip fuera del viewport (E1-b) y scroll interno del panel cerrándolo
 * (E1-a).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef, useState } from "react";
import {
  useListboxPosition,
  useListboxDismiss,
  POPOVER_GAP,
  VIEWPORT_MARGIN,
} from "@/hooks/use-listbox-popover";

// ─── Helpers ────────────────────────────────────────────────────────────────

function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {},
      ...rect,
    }) as DOMRect;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

interface HarnessProps {
  triggerRect: Partial<DOMRect>;
  panelHeight: number;
  intrinsicMaxHeight?: number;
}

function Harness({ triggerRect, panelHeight, intrinsicMaxHeight = 260 }: HarnessProps) {
  const [open, setOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useListboxDismiss(open, close, triggerRef, panelRef);
  const pos = useListboxPosition(open, triggerRef, panelRef, intrinsicMaxHeight);

  return (
    <div>
      <button
        ref={(el) => {
          triggerRef.current = el;
          if (el) stubRect(el, triggerRect);
        }}
        data-testid="trigger"
      >
        trigger
      </button>
      {open ? (
        <div
          ref={(el) => {
            panelRef.current = el;
            if (el) stubRect(el, { height: panelHeight });
          }}
          data-testid="panel"
          tabIndex={-1}
        >
          <span data-testid="top">{pos.top}</span>
          <span data-testid="left">{pos.left}</span>
          <span data-testid="width">{pos.width}</span>
          <span data-testid="maxHeight">{pos.maxHeight}</span>
        </div>
      ) : (
        <span data-testid="closed">closed</span>
      )}
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useListboxPosition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preferencia abajo: cuando entra por debajo, ancla top = rect.bottom + GAP", () => {
    setViewport(1000, 800);
    render(
      <Harness
        triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }}
        panelHeight={200}
      />,
    );

    expect(screen.getByTestId("top")).toHaveTextContent(String(130 + POPOVER_GAP));
    expect(screen.getByTestId("left")).toHaveTextContent("50");
    expect(screen.getByTestId("width")).toHaveTextContent("200");
  });

  it("flip arriba: cuando no entra abajo pero sí arriba, ancla top = rect.top - alto - GAP", () => {
    setViewport(1000, 400);
    // Disparador cerca del borde inferior: poco espacio abajo, mucho arriba.
    render(
      <Harness
        triggerRect={{ top: 300, bottom: 330, left: 50, right: 250, width: 200 }}
        panelHeight={200}
      />,
    );

    expect(screen.getByTestId("top")).toHaveTextContent(String(300 - 200 - POPOVER_GAP));
  });

  it("no entra en ningún lado: clampea top y recorta maxHeight al espacio disponible", () => {
    // Viewport bajo, disparador en el medio: ni arriba ni abajo caben los 260px.
    setViewport(1000, 200);
    render(
      <Harness
        triggerRect={{ top: 90, bottom: 110, left: 50, right: 250, width: 200 }}
        panelHeight={260}
        intrinsicMaxHeight={260}
      />,
    );

    const top = Number(screen.getByTestId("top").textContent);
    const maxHeight = Number(screen.getByTestId("maxHeight").textContent);

    expect(top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(top).toBeLessThanOrEqual(200 - maxHeight - VIEWPORT_MARGIN + 0.001);
    // El maxHeight se recorta por debajo del tope intrínseco (260).
    expect(maxHeight).toBeLessThan(260);
  });

  it("clamp horizontal: si el disparador está pegado al borde derecho, recorta left", () => {
    setViewport(500, 800);
    render(
      <Harness
        triggerRect={{ top: 50, bottom: 80, left: 400, right: 700, width: 300 }}
        panelHeight={100}
      />,
    );

    const left = Number(screen.getByTestId("left").textContent);
    // left + width no debe exceder viewport - VIEWPORT_MARGIN.
    expect(left + 300).toBeLessThanOrEqual(500 - VIEWPORT_MARGIN + 0.001);
    expect(left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  });

  it("segunda pasada: recalcula con el alto real del panel tras montar", () => {
    // Con panelHeight muy chico, debería entrar abajo aunque el estimado (260) no entrara.
    setViewport(1000, 350);
    render(
      <Harness
        triggerRect={{ top: 200, bottom: 230, left: 50, right: 250, width: 200 }}
        panelHeight={40}
        intrinsicMaxHeight={260}
      />,
    );

    // Con alto real 40, entra abajo: top = 230 + GAP.
    expect(screen.getByTestId("top")).toHaveTextContent(String(230 + POPOVER_GAP));
  });
});

describe("useListboxDismiss", () => {
  beforeEach(() => {
    setViewport(1000, 800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scroll ORIGINADO DENTRO del panel no cierra (bug E1-a)", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.scroll(screen.getByTestId("panel"));

    expect(screen.queryByTestId("panel")).toBeInTheDocument();
    expect(screen.queryByTestId("closed")).not.toBeInTheDocument();
  });

  it("scroll EXTERNO al panel (p. ej. el cuerpo del modal / document) cierra", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.scroll(document.body);

    expect(screen.getByTestId("closed")).toBeInTheDocument();
  });

  it("resize cierra", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.resize(window);

    expect(screen.getByTestId("closed")).toBeInTheDocument();
  });

  it("clic afuera (fuera de trigger y panel) cierra", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.mouseDown(document.body);

    expect(screen.getByTestId("closed")).toBeInTheDocument();
  });

  it("clic dentro del panel no cierra", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.mouseDown(screen.getByTestId("panel"));

    expect(screen.queryByTestId("closed")).not.toBeInTheDocument();
  });

  it("Esc cierra y devuelve el foco al disparador", () => {
    render(
      <Harness triggerRect={{ top: 100, bottom: 130, left: 50, right: 250, width: 200 }} panelHeight={100} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByTestId("closed")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId("trigger"));
  });
});
