/**
 * Tests de UniqueGridCard (Ola 3, P2 — grilla día × mes de Únicos).
 *
 * Verifica:
 * - Cabecera: título editable, YearStepper, selector de moneda, botón quitar
 * - Estado de carga (skeleton con role="status")
 * - Estado de error + botón Reintentar
 * - Estado vacío (overlay "Sin gastos únicos en {año}.")
 * - Grilla: header de meses, columna de días, celdas
 * - Footer: métricas por mes (total, prom, %dif, infl, real)
 * - Filtro de categorías: ChartLegend chips + LegendAllChip
 * - Integración con useUnicoGrid (hook correcto llamado con today)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UnicoGridResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useUnicoGrid: vi.fn(),
  UNICO_GRID_QUERY_KEY: (year: number, key: string | null) => ["reports-unico-grid", year, key],
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    settings: { defaultCurrency: "ARS", lastExchangeRate: null },
    defaultCurrency: "ARS",
    lastExchangeRate: null,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  })),
}));

import { useUnicoGrid } from "@/hooks/use-reports";
import { UniqueGridCard } from "@/components/charts/unique-grid-card";

const mockUseUnicoGrid = vi.mocked(useUnicoGrid);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

/** Genera una grilla 31×12 con valor constante (en centavos). */
function makeGrid(cents: number): number[][] {
  return Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => cents));
}

/** Genera un breakdown 31×12 vacío. */
function makeBreakdownEmpty(): UnicoGridResponse["breakdown"] {
  return Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => []));
}

/** Footer de 12 meses con datos de ejemplo. */
function makeFooter(): UnicoGridResponse["footer"] {
  return Array.from({ length: 12 }, (_, i) => ({
    total: i < 6 ? 50000 : 0,
    dailyAvg: i < 6 ? 1666 : null,
    pctVsPrev: i === 0 ? null : i < 6 ? 5.25 : null,
    inflationPct: i < 6 ? 3.2 : null,
    pctVsPrevAdj: i < 6 ? 2.05 : null,
  }));
}

const mockData: UnicoGridResponse = {
  year: 2026,
  currency: "ARS",
  colorAnchorCents: 150000, // equivalente a 15 USD a TC de referencia en ARS
  grid: makeGrid(0), // todos en 0 para simplificar
  breakdown: makeBreakdownEmpty(),
  footer: makeFooter(),
  availableCategories: [
    { categoryId: "cat-1", name: "Alimentación", color: "#4F86C6" },
    { categoryId: "cat-2", name: "Transporte", color: "#E07B54" },
  ],
};

const emptyData: UnicoGridResponse = {
  year: 2026,
  currency: "ARS",
  colorAnchorCents: 150000,
  grid: makeGrid(0),
  breakdown: makeBreakdownEmpty(),
  footer: Array.from({ length: 12 }, () => ({
    total: 0,
    dailyAvg: 0,
    pctVsPrev: null,
    inflationPct: null,
    pctVsPrevAdj: null,
  })),
  availableCategories: [],
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

type HookReturn = ReturnType<typeof useUnicoGrid>;

function makeSuccessReturn(data: UnicoGridResponse = mockData): HookReturn {
  return {
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as unknown as HookReturn;
}

function renderCard(props: Partial<React.ComponentProps<typeof UniqueGridCard>> = {}) {
  const defaults = { year: 2026 };
  return render(<UniqueGridCard {...defaults} {...props} />, { wrapper: createWrapper() });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UniqueGridCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("muestra el placeholder del título cuando no hay título propio", () => {
    renderCard({ titlePlaceholder: "Reporte 3" });
    expect(screen.getByText("Reporte 3")).toBeInTheDocument();
  });

  it("muestra el título propio cuando se provee", () => {
    renderCard({ title: "Mi grilla anual" });
    expect(screen.getByText("Mi grilla anual")).toBeInTheDocument();
  });

  it("muestra el stepper de año con ‹ y ›", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año siguiente/i })).toBeInTheDocument();
  });

  it("NO muestra el botón quitar cuando removable=false", () => {
    renderCard({ removable: false });
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
  });

  it("muestra el botón quitar cuando removable=true", () => {
    renderCard({ removable: true });
    expect(screen.getByRole("button", { name: /quitar reporte/i })).toBeInTheDocument();
  });

  it("el botón quitar abre el popover de confirmación", () => {
    renderCard({ removable: true, onRemove: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    expect(screen.getByText(/quitar este reporte/i)).toBeInTheDocument();
  });

  it("confirmar quitar llama onRemove", () => {
    const onRemove = vi.fn();
    renderCard({ removable: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    const quitarBtns = screen.getAllByText("Quitar");
    const confirmBtn = quitarBtns[quitarBtns.length - 1];
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("UniqueGridCard — estados de carga/error/vacío", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra skeleton (role=status) durante la carga", () => {
    mockUseUnicoGrid.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: true,
      isPending: true,
      isSuccess: false,
    } as unknown as HookReturn);
    renderCard();
    expect(screen.getByRole("status", { name: /cargando reporte/i })).toBeInTheDocument();
  });

  it("muestra error con botón Reintentar cuando falla", () => {
    mockUseUnicoGrid.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: false,
      isError: true,
      isPending: false,
      isSuccess: false,
      error: new Error("500"),
    } as unknown as HookReturn);
    renderCard();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("muestra overlay 'Sin gastos únicos' cuando todos los totales son 0", () => {
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard({ year: 2026 });
    expect(screen.getByText(/sin gastos únicos en 2026/i)).toBeInTheDocument();
  });

  it("NO muestra overlay de vacío cuando hay gastos", () => {
    // Poner total > 0 en al menos un mes
    const withData: UnicoGridResponse = {
      ...emptyData,
      footer: emptyData.footer.map((f, i) => i === 0 ? { ...f, total: 5000 } : f),
    };
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(withData));
    renderCard({ year: 2026 });
    expect(screen.queryByText(/sin gastos únicos en 2026/i)).not.toBeInTheDocument();
  });
});

describe("UniqueGridCard — estructura de la grilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("muestra un <table> con aria-label que incluye el año", () => {
    const { container } = renderCard({ year: 2026 });
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(table?.getAttribute("aria-label")).toContain("2026");
  });

  it("header de meses contiene los 12 meses abreviados", () => {
    renderCard();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (const m of months) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }
  });

  it("columna de días contiene los 31 días", () => {
    const { container } = renderCard();
    const dayHeaders = container.querySelectorAll("th[scope='row']");
    expect(dayHeaders.length).toBe(31);
    // El primer día es "1" y el último es "31"
    expect(dayHeaders[0]?.textContent?.trim()).toBe("1");
    expect(dayHeaders[30]?.textContent?.trim()).toBe("31");
  });

  it("tiene una fila de footer (<tfoot>)", () => {
    const { container } = renderCard();
    const tfoot = container.querySelector("tfoot");
    expect(tfoot).toBeTruthy();
  });
});

describe("UniqueGridCard — footer de métricas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("muestra las etiquetas de métricas del footer (prom, vs ant, infl, real)", () => {
    renderCard();
    // Las etiquetas del footer son texto pequeño (uppercase)
    // Puede haber múltiples instancias (una por mes)
    const promLabels = screen.getAllByText("prom");
    expect(promLabels.length).toBeGreaterThan(0);
    const vsAntLabels = screen.getAllByText("vs ant");
    expect(vsAntLabels.length).toBeGreaterThan(0);
  });

  it("muestra '—' cuando pctVsPrev es null (primer mes sin prev)", () => {
    renderCard();
    // El primer mes (enero, índice 0) tiene pctVsPrev=null → "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});

describe("UniqueGridCard — filtro de categorías", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("muestra chips de las categorías disponibles", () => {
    renderCard();
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("muestra el chip 'Ninguna' (LegendAllChip) cuando todas activas", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Ocultar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Ninguna")).toBeInTheDocument();
  });

  it("muestra el chip 'Todas' cuando hay alguna desactivada", () => {
    renderCard({ categoryIds: ["cat-2"] });
    expect(screen.getByRole("button", { name: "Mostrar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
  });

  it("clic en 'Ninguna' llama onCategoryIdsChange con []", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Ocultar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith([]);
  });

  it("clic en 'Todas' llama onCategoryIdsChange con null", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ categoryIds: ["cat-2"], onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith(null);
  });

  it("NO muestra chips ni LegendAllChip cuando no hay categorías disponibles", () => {
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard();
    expect(screen.queryByRole("button", { name: "Ocultar todas las categorías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar todas las categorías" })).not.toBeInTheDocument();
  });
});

describe("UniqueGridCard — hook y parámetros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("llama a useUnicoGrid con el año correcto", () => {
    renderCard({ year: 2025 });
    expect(mockUseUnicoGrid).toHaveBeenCalledWith(
      2025,
      null,    // categoryIds default
      undefined, // currency default
      expect.any(String),
    );
  });

  it("pasa today en formato YYYY-MM-DD al hook", () => {
    renderCard({ year: 2026 });
    const calls = mockUseUnicoGrid.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const todayArg = calls[0]?.[3];
    expect(todayArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("pasa currency al hook cuando se provee", () => {
    renderCard({ year: 2026, currency: "USD" });
    expect(mockUseUnicoGrid).toHaveBeenCalledWith(
      2026,
      null,   // categoryIds default
      "USD",
      expect.any(String),
    );
  });

  it("el botón Reintentar llama a refetch", () => {
    const refetch = vi.fn();
    mockUseUnicoGrid.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("500"),
      refetch,
    } as unknown as HookReturn);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("UniqueGridCard — botón de refrescar per-card (P5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("está presente sin depender de removable", () => {
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
    renderCard({ removable: false });
    expect(screen.getByRole("button", { name: /actualizar reporte/i })).toBeInTheDocument();
  });

  it("al hacer clic, llama a refetch", () => {
    const refetch = vi.fn();
    mockUseUnicoGrid.mockReturnValue({ ...makeSuccessReturn(), refetch });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /actualizar reporte/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se deshabilita y marca aria-busy mientras isFetching=true", () => {
    mockUseUnicoGrid.mockReturnValue({
      ...makeSuccessReturn(),
      isFetching: true,
    } as unknown as HookReturn);
    renderCard();
    const btn = screen.getByRole("button", { name: /actualizar reporte/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

describe("UniqueGridCard — stepper de año", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("llama onYearChange al hacer clic en ‹ (año anterior)", () => {
    const onYearChange = vi.fn();
    renderCard({ year: 2025, onYearChange });
    fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
    expect(onYearChange).toHaveBeenCalledWith(2024);
  });

  it("› deshabilitado cuando year === año actual", () => {
    const currentYear = new Date().getFullYear();
    renderCard({ year: currentYear });
    const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
    const isDisabled =
      nextBtn.hasAttribute("disabled") || nextBtn.getAttribute("aria-disabled") === "true";
    expect(isDisabled).toBe(true);
  });
});

/**
 * Obtiene la celda de datos del tfoot en el índice dado (0-based, excluyendo esquina).
 * La celda esquina es la primera `td` del tfoot (índice 0); los datos empiezan en índice 1.
 * Usa nth-child para evitar problemas de selector de clase en jsdom.
 */
function getFooterDataCell(container: HTMLElement, cellIndex: number): HTMLElement | null {
  // nth-child es 1-based; la celda esquina es la 1ra, la primera de datos es la 2da
  return container.querySelector(
    `tfoot tr td:nth-child(${cellIndex + 2})`,
  ) as HTMLElement | null;
}

describe("UniqueGridCard — tooltip de footer (§4b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn());
  });

  it("el footer NO tiene atributo title (se eliminó el tooltip nativo)", () => {
    const { container } = renderCard();
    // Verificar que ninguna celda de datos del footer tiene atributo title
    for (let i = 0; i < 12; i++) {
      const cell = getFooterDataCell(container, i);
      if (cell) {
        expect(cell.getAttribute("title")).toBeNull();
      }
    }
  });

  it("el footer muestra el tooltip portaled al hacer mouseenter en una celda con datos", () => {
    const { container } = renderCard();
    // Primera celda de datos (enero, índice 0)
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      // El tooltip portaled debe aparecer con el nombre largo del mes
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      // El tooltip tiene el texto "Enero" (primer mes, nombre largo)
      expect(screen.getByRole("tooltip")).toHaveTextContent("Enero");
    }
  });

  it("el tooltip de footer contiene las 5 labels de métricas", () => {
    const { container } = renderCard();
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("Total");
      expect(tooltip).toHaveTextContent("Promedio diario");
      expect(tooltip).toHaveTextContent("vs. mes anterior");
      expect(tooltip).toHaveTextContent("Inflación");
      expect(tooltip).toHaveTextContent("vs. anterior (real)");
    }
  });

  it("el tooltip de footer muestra '—' para métricas null (primer mes sin anterior)", () => {
    const { container } = renderCard();
    // El primer mes (índice 0) tiene pctVsPrev=null y pctVsPrevAdj=null
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      const tooltip = screen.getByRole("tooltip");
      // pctVsPrev y pctVsPrevAdj son null → deben mostrar "—" en texto
      expect(tooltip.textContent).toContain("—");
    }
  });

  it("el tooltip desaparece al hacer mouseleave del footer", () => {
    const { container } = renderCard();
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      fireEvent.mouseLeave(firstDataCell);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
  });

  it("el tooltip de footer muestra inflación en pts sin dividir ni multiplicar", () => {
    // inflationPct = 3.2 → debe mostrar "3,20pts" no "0,03pts" ni "320,00pts"
    const { container } = renderCard();
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      const tooltip = screen.getByRole("tooltip");
      // "3,20pts" en el tooltip (inflationPct = 3.2)
      expect(tooltip.textContent).toContain("3,20pts");
    }
  });
});

describe("UniqueGridCard — tooltip de celda con desglose (§8)", () => {
  const dataWithBreakdown: UnicoGridResponse = {
    ...mockData,
    // día 1 (dayIdx=0), mes enero (monthIdx=0): tiene 2 categorías
    breakdown: (() => {
      const bd = makeBreakdownEmpty();
      // dayIdx=0, monthIdx=0: 2 categorías
      bd[0]![0] = [
        { categoryId: "cat-1", amount: 30000 }, // $300 Alimentación
        { categoryId: "cat-2", amount: 10000 }, // $100 Transporte
      ];
      return bd;
    })(),
    grid: (() => {
      const g = makeGrid(0);
      // Día 1, enero: $400 total
      g[0]![0] = 40000;
      return g;
    })(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(dataWithBreakdown));
  });

  it("el tooltip de celda muestra el desglose de categorías al hacer mouseenter", () => {
    const { container } = renderCard({ year: 2026 });
    const tbody = container.querySelector("tbody");
    // Primera fila de datos (día 1), segunda celda de td (primera columna de mes, enero)
    const firstRow = tbody?.querySelector("tr");
    const cells = firstRow?.querySelectorAll("td");
    // cells[0] es la celda de enero (índice 0, día 1)
    const januaryCell = cells?.[0];
    if (januaryCell) {
      fireEvent.mouseEnter(januaryCell);
      const tooltip = screen.getByRole("tooltip");
      // Nombre de las categorías
      expect(tooltip).toHaveTextContent("Alimentación");
      expect(tooltip).toHaveTextContent("Transporte");
    }
  });

  it("el tooltip de celda muestra 'Sin gastos' cuando el día tiene $0 y breakdown vacío", () => {
    // emptyData tiene grid=0 y breakdown vacío
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(emptyData));
    const { container } = renderCard({ year: 2026 });
    const tbody = container.querySelector("tbody");
    const firstRow = tbody?.querySelector("tr");
    const cells = firstRow?.querySelectorAll("td");
    const januaryCell = cells?.[0];
    if (januaryCell) {
      fireEvent.mouseEnter(januaryCell);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("Sin gastos");
    }
  });

  it("el tooltip de celda muestra la fecha en el encabezado", () => {
    const { container } = renderCard({ year: 2026 });
    const tbody = container.querySelector("tbody");
    const firstRow = tbody?.querySelector("tr");
    const cells = firstRow?.querySelectorAll("td");
    const januaryCell = cells?.[0];
    if (januaryCell) {
      fireEvent.mouseEnter(januaryCell);
      const tooltip = screen.getByRole("tooltip");
      // Debe contener "Ene" + "1" + "2026"
      expect(tooltip.textContent).toMatch(/Ene/);
      expect(tooltip.textContent).toMatch(/2026/);
    }
  });

  it("el tooltip de celda desaparece al hacer mouseleave", () => {
    const { container } = renderCard({ year: 2026 });
    const tbody = container.querySelector("tbody");
    const firstRow = tbody?.querySelector("tr");
    const cells = firstRow?.querySelectorAll("td");
    const januaryCell = cells?.[0];
    if (januaryCell) {
      fireEvent.mouseEnter(januaryCell);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      fireEvent.mouseLeave(januaryCell);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
  });
});

describe("UniqueGridCard — formato de inflación (ajuste #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inflationPct=3.5 se muestra como '3,50' pts (no dividido ni multiplicado)", () => {
    const dataWithInflation: UnicoGridResponse = {
      ...mockData,
      footer: Array.from({ length: 12 }, (_, i) => ({
        total: 50000,
        dailyAvg: 1666,
        pctVsPrev: i === 0 ? null : 5.25,
        inflationPct: 3.5, // 3.5 pts% → debe mostrar "3,50"
        pctVsPrevAdj: 2.05,
      })),
    };
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(dataWithInflation));
    renderCard();
    // En el footer se muestran los pts de inflación abreviados
    // Buscamos el texto "3,50pts" en la pantalla
    const inflTexts = screen.getAllByText("3,50pts");
    expect(inflTexts.length).toBeGreaterThan(0);
  });

  it("inflationPct=3.5 en el tooltip del footer muestra '3,20pts' o el valor correcto", () => {
    // Testeamos que la inflación se muestra sin transformación alguna
    const dataWith32: UnicoGridResponse = {
      ...mockData,
      footer: Array.from({ length: 12 }, () => ({
        total: 50000,
        dailyAvg: 1666,
        pctVsPrev: null,
        inflationPct: 3.2, // el value del backend es 3.2 = 3.2 pts%
        pctVsPrevAdj: null,
      })),
    };
    mockUseUnicoGrid.mockReturnValue(makeSuccessReturn(dataWith32));
    const { container } = renderCard();
    const firstDataCell = getFooterDataCell(container, 0);
    expect(firstDataCell).not.toBeNull();
    if (firstDataCell) {
      fireEvent.mouseEnter(firstDataCell);
      const tooltip = screen.getByRole("tooltip");
      // "3,20pts" en el tooltip (no "320,00pts" ni "0,03pts")
      expect(tooltip.textContent).toContain("3,20pts");
    }
  });
});
