/**
 * Tests de LimitsInfoPopover — popover informativo de límites por superficie
 * (P2). Solo lectura: no marca, no evalúa, no avisa; únicamente lista qué
 * límites observan una superficie. Spec: docs/design.md
 * §"Popover informativo de límites por superficie (Límites y Alertas — P2)".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { LimitConfig } from "@/types/limit";
import type { LimitSurface } from "@/lib/limits/catalog";

// ─── Mocks ────────────────────────────────────────────────────────────────────

let limitsOverride: LimitConfig[] = [];

vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(() => ({
    limits: limitsOverride,
    isLoading: false,
    isSaving: false,
    create: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [
      { id: "cat-1", name: "Alimentación", color: "#E23B3B", scope: "BOTH", isActive: true },
    ],
    isLoading: false,
    isError: false,
  })),
}));

import { LimitsInfoPopover } from "@/components/limits/limits-info-popover";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function makeLimit(overrides: Partial<LimitConfig> = {}): LimitConfig {
  return {
    id: overrides.id ?? "limit-1",
    enabled: true,
    anchorKey: "reporte.ie.gastoMes",
    temporalScope: "all",
    operator: "gt",
    threshold: 300000,
    nature: "passive",
    effect: "dot",
    ...overrides,
  };
}

function renderPopover(surface: LimitSurface = "reporte-income-expense") {
  return render(<LimitsInfoPopover surface={surface} />, { wrapper: createWrapper() });
}

beforeEach(() => {
  limitsOverride = [];
});

describe("LimitsInfoPopover — montaje condicional (cero impacto)", () => {
  it("sin límites para la surface, no renderiza el disparador", () => {
    limitsOverride = [];
    renderPopover("reporte-income-expense");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con límites de OTRA surface, tampoco renderiza el disparador", () => {
    limitsOverride = [makeLimit({ anchorKey: "mes.total.gasto" })]; // surface "mes"
    renderPopover("reporte-income-expense");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con ≥1 límite de la surface, el disparador se monta", () => {
    limitsOverride = [makeLimit({ anchorKey: "reporte.ie.gastoMes" })];
    renderPopover("reporte-income-expense");
    expect(screen.getByRole("button", { name: /límites que observan este reporte/i })).toBeInTheDocument();
  });
});

describe("LimitsInfoPopover — disparo y cierre", () => {
  beforeEach(() => {
    limitsOverride = [makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Gasto anual alto" })];
  });

  it("click abre el popover con el listado", () => {
    renderPopover("reporte-income-expense");
    const trigger = screen.getByRole("button", { name: /límites que observan este reporte/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Límites de este reporte")).toBeInTheDocument();
    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();
    expect(screen.getByText("Gasto anual alto")).toBeInTheDocument();
  });

  it("re-clic en el disparador cierra (toggle)", () => {
    renderPopover("reporte-income-expense");
    const trigger = screen.getByRole("button", { name: /límites que observan este reporte/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByText("Marcan un dato")).not.toBeInTheDocument();
  });

  it("Esc cierra y devuelve el foco al disparador", () => {
    renderPopover("reporte-income-expense");
    const trigger = screen.getByRole("button", { name: /límites que observan este reporte/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Marcan un dato")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("click fuera cierra el popover", () => {
    renderPopover("reporte-income-expense");
    const trigger = screen.getByRole("button", { name: /límites que observan este reporte/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Marcan un dato")).not.toBeInTheDocument();
  });
});

describe("LimitsInfoPopover — contenido del listado", () => {
  it("línea 1 usa el rótulo del anclaje cuando no hay label propio; línea 2 solo la condición", () => {
    limitsOverride = [makeLimit({ anchorKey: "reporte.ie.gastoMes", operator: "gt", threshold: 300000 })];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Gasto de un mes (serie anual)")).toBeInTheDocument();
    expect(screen.getByText("> 300.000")).toBeInTheDocument();
  });

  it("con label propio, la línea 2 antepone el rótulo del anclaje a la condición", () => {
    limitsOverride = [
      makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Mi límite", operator: "gt", threshold: 300000 }),
    ];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Mi límite")).toBeInTheDocument();
    expect(screen.getByText(/Gasto de un mes \(serie anual\)/)).toBeInTheDocument();
    expect(screen.getByText("> 300.000")).toBeInTheDocument();
  });

  it("límite deshabilitado se lista atenuado con la etiqueta Desactivado", () => {
    limitsOverride = [makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Mi límite", enabled: false })];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Mi límite")).toBeInTheDocument();
    expect(screen.getByText("Desactivado")).toBeInTheDocument();
    // Dos portadores de atenuación (spec §3): la fila entera del ítem lleva
    // opacity-60 (no solo el color de la etiqueta "Desactivado").
    expect(screen.getByRole("listitem")).toHaveClass("opacity-60");
  });

  it("límite pasivo con temporalScope 'current' lleva el qualifier 'Solo mes en curso'", () => {
    limitsOverride = [
      makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Mi límite", temporalScope: "current" }),
    ];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Solo mes en curso")).toBeInTheDocument();
  });

  it("límite pasivo con temporalScope 'all' NO lleva qualifier", () => {
    limitsOverride = [
      makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Mi límite", temporalScope: "all" }),
    ];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByText("Solo mes en curso")).not.toBeInTheDocument();
  });

  it("refinamiento de categoría antecede el nombre con un punto de color y el nombre de la categoría", () => {
    limitsOverride = [
      makeLimit({
        anchorKey: "mes.item.monto",
        refinement: { categoryId: "cat-1" },
      }),
    ];
    renderPopover("mes");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/Alimentación/)).toBeInTheDocument();
    expect(screen.getByText(/Monto de un movimiento/)).toBeInTheDocument();
  });

  it("refinamiento de sección incorpora el nombre de la sección en el texto de línea 1", () => {
    limitsOverride = [
      makeLimit({
        anchorKey: "mes.seccion.subtotal",
        refinement: { section: "fijos" },
      }),
    ];
    renderPopover("mes");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/Subtotal de sección/)).toBeInTheDocument();
    expect(screen.getByText(/Fijos/)).toBeInTheDocument();
  });
});

describe("LimitsInfoPopover — grupos por naturaleza", () => {
  it("el grupo 'Avisan al guardar' aparece en /mes cuando hay límites activos", () => {
    limitsOverride = [
      makeLimit({ id: "l1", anchorKey: "mes.total.gasto", nature: "passive" }),
      makeLimit({ id: "l2", anchorKey: "mes.total.gasto", nature: "active", effect: undefined }),
    ];
    renderPopover("mes");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();
    expect(screen.getByText("Avisan al guardar")).toBeInTheDocument();
  });

  it("el grupo 'Avisan al guardar' NUNCA aparece fuera de /mes", () => {
    // Dato defensivo: aunque hipotéticamente hubiera un límite `nature: active`
    // apuntando a una key de reportes, el componente lo excluye por surface !== "mes".
    limitsOverride = [
      makeLimit({ id: "l1", anchorKey: "reporte.ie.gastoMes", nature: "passive" }),
      makeLimit({ id: "l2", anchorKey: "reporte.ie.gastoMes", nature: "active", effect: undefined }),
    ];
    renderPopover("reporte-income-expense");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Marcan un dato")).toBeInTheDocument();
    expect(screen.queryByText("Avisan al guardar")).not.toBeInTheDocument();
  });
});

describe("LimitsInfoPopover — hover en desktop (aditivo, no exclusivo)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    limitsOverride = [makeLimit({ anchorKey: "reporte.ie.gastoMes", label: "Mi límite" })];
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it("hover con delay abre el popover en dispositivos hover-capable", () => {
    renderPopover("reporte-income-expense");
    const trigger = screen.getByRole("button", { name: /límites que observan este reporte/i });

    fireEvent.mouseEnter(trigger);
    expect(screen.queryByText("Mi límite")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByText("Mi límite")).toBeInTheDocument();
  });
});
