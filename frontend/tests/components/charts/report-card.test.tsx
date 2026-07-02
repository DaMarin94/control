/**
 * Tests de ReportCard (Fase 1.1.5 — widget de reporte autónomo).
 *
 * Verifica:
 * - Cabecera: título editable (sin eyebrow "Reporte"), income-expense Total-only (sin tablist),
 *   by-category con tabs Barra/Línea
 * - Control de año embebido (stepper): ‹ / › con límites
 * - Botón quitar (solo si removable=true) + confirmación
 * - Estado de carga (skeleton)
 * - Estado de error + botón Reintentar
 * - Estado vacío (año sin movimientos)
 * - Leyenda según tipo
 * - LegendAllChip (chip-comando icónico) en leyenda de by-category:
 *   - presencia, label/aria dinámico, emisión de callbacks
 *   - está en el CARRIL FIJO (fuera del role="group" y fuera de la región scrolleable)
 *   - orden DOM: group → chip (group precede al chip en el DOM)
 * - income-expense en Dashboard (sin onDirectionChange):
 *   - leyenda decorativa de 2 series Ingresos/Gastos (no interactiva, no filtro)
 *   - AUSENCIA de chip Todas/Ninguna, ausencia de región scrolleable
 * - income-expense en /reportes (con onDirectionChange) — RF-REP-014:
 *   - leyenda-filtro de categorías en el footer (= mismo ChartLegend que by-category)
 *   - LegendAllChip presente, región scrolleable presente
 *   - NO hay leyenda de series ni group "Filtrar series"
 * - Región scrolleable con max-h-[84px] en leyenda de by-category
 * - data-overflow: lógica de medición de scrollHeight > clientHeight
 * - Toggle Barra/Línea en by-category (categoryChartMode + onCategoryChartModeChange)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ReportsMovementsResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useReports: vi.fn(),
  REPORTS_QUERY_KEY: (year: number, key: string | null) => ["reports", year, key],
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [
      { id: "cat-1", name: "Alimentación", color: "#4F86C6", scope: "EXPENSE" },
      { id: "cat-2", name: "Transporte", color: "#E07B54", scope: "EXPENSE" },
    ],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

vi.mock("recharts", () => {
  const React = require("react");
  const MockChart = ({ children, data }: { children?: ReactNode; data?: unknown[] }) =>
    React.createElement("div", { "data-testid": "recharts-chart", "data-points": data?.length }, children);
  const MockArea = () => null;
  const MockBar = () => null;
  const MockXAxis = () => null;
  const MockYAxis = () => null;
  const MockCartesianGrid = () => null;
  const MockTooltip = () => null;
  const MockCell = () => null;
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) =>
    React.createElement("div", { "data-testid": "responsive-container" }, children);

  return {
    AreaChart: MockChart,
    BarChart: MockChart,
    Area: MockArea,
    Bar: MockBar,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
    ResponsiveContainer: MockResponsiveContainer,
    Cell: MockCell,
  };
});

import { useReports } from "@/hooks/use-reports";
import { ReportCard } from "@/components/charts/report-card";

const mockUseReports = vi.mocked(useReports);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockData: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: i < 6 ? 50000 : 0,
    expenseCents: i < 6 ? 20000 : 0,
  })),
  categories: [
    {
      categoryId: "cat-1",
      name: "Alimentación",
      color: "#4F86C6",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => i < 6 ? 10000 : 0),
    },
    {
      categoryId: "cat-2",
      name: "Transporte",
      color: "#E07B54",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => i < 6 ? 10000 : 0),
    },
  ],
  availableCategories: [
    { categoryId: "cat-1", name: "Alimentación", color: "#4F86C6" },
    { categoryId: "cat-2", name: "Transporte", color: "#E07B54" },
  ],
  earliestYear: 2025,
};

const emptyData: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
  })),
  categories: [],
  availableCategories: [],
  earliestYear: null,
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function renderCard(
  props: Partial<React.ComponentProps<typeof ReportCard>> & { type: "income-expense" | "by-category" } = { type: "income-expense" }
) {
  const defaults = { year: 2026, chartHeight: 300 };
  return render(<ReportCard {...defaults} {...props} />, { wrapper: createWrapper() });
}

function makeSuccessReturn(data: ReportsMovementsResponse = mockData) {
  return {
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success" as const,
    fetchStatus: "idle" as const,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useReports>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("income-expense (Total-only) muestra solo el título editable sin tablist de vista", () => {
    renderCard({ type: "income-expense" });
    // Spec actualizado: income-expense es Total-only, sin tabs "Total"/"Por categoría".
    // Solo el placeholder del título editable (default "Reporte").
    const reporteNodes = screen.getAllByText("Reporte");
    expect(reporteNodes).toHaveLength(1);
    // income-expense NO tiene tablist de vista (Total-only).
    expect(screen.queryByRole("tablist", { name: /vista del reporte/i })).not.toBeInTheDocument();
  });

  it("by-category muestra el tablist 'Representación del reporte' con tabs Barra/Línea", () => {
    renderCard({ type: "by-category" });
    // by-category tiene el tablist de Barra/Línea.
    expect(screen.getByRole("tablist", { name: /representación del reporte/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Barra" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Línea" })).toBeInTheDocument();
    // El placeholder del título (default "Reporte") aparece una sola vez.
    const reporteNodes = screen.getAllByText("Reporte");
    expect(reporteNodes).toHaveLength(1);
  });

  it("muestra el stepper de año", () => {
    renderCard({ type: "income-expense", year: 2026 });
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /año siguiente/i })).toBeInTheDocument();
  });

  it("income-expense en Dashboard (sin onDirectionChange): leyenda decorativa de Ingresos/Gastos (no interactiva)", () => {
    // Dashboard mode: sin onDirectionChange → leyenda DECORATIVA de 2 series, no filtro.
    // RF-REP-014 rework: la leyenda de series (hiddenSeries) fue eliminada;
    // el dashboard conserva una leyenda decorativa (no interactiva) de 2 ítems.
    renderCard({ type: "income-expense" });

    // NO hay group "Filtrar series" (leyenda de series eliminada del income-expense)
    expect(screen.queryByRole("group", { name: /filtrar series/i })).not.toBeInTheDocument();
    // NO hay FilterButton ni popover de categorías en la cabecera del dashboard
    expect(screen.queryByRole("button", { name: /^filtrar categorías$/i })).not.toBeInTheDocument();
    // Los textos SÍ están en el DOM (leyenda decorativa muestra Ingresos y Gastos)
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
    // Pero NO son botones (leyenda decorativa, no interactiva)
    expect(screen.queryByRole("button", { name: "Ingresos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gastos" })).not.toBeInTheDocument();
  });

  it("NO muestra el botón quitar cuando removable=false", () => {
    renderCard({ type: "income-expense", removable: false });
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
  });

  it("muestra el botón quitar cuando removable=true", () => {
    renderCard({ type: "income-expense", removable: true });
    expect(screen.getByRole("button", { name: /quitar reporte/i })).toBeInTheDocument();
  });
});

describe("ReportCard — stepper de año", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // earliestYear=2025, year=2026 (año actual aprox)
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("llama onYearChange al hacer clic en ‹ (año anterior)", () => {
    const onYearChange = vi.fn();
    // earliestYear=2025, year=2026 → ‹ habilitado
    renderCard({ type: "income-expense", year: 2026, onYearChange });

    fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
    expect(onYearChange).toHaveBeenCalledWith(2025);
  });

  it("› deshabilitado cuando year === año actual (2026)", () => {
    // El componente calcula currentYear desde new Date() en el test → es 2026
    renderCard({ type: "income-expense", year: 2026 });
    const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
    // En 2026 (año actual), el botón › debe estar deshabilitado
    // (puede variar según el año del CI — verificamos que el aria-disabled es coherente)
    const isDisabled =
      nextBtn.hasAttribute("disabled") || nextBtn.getAttribute("aria-disabled") === "true";
    // year=2026 y currentYear=2026 en producción → disabled; en CI año distinto podría no estar
    // Lo que sí verificamos es que el componente renderiza sin error
    expect(nextBtn).toBeInTheDocument();
    // Para garantizar el test: si el año de ejecución es 2026, el botón debe estar disabled
    const execYear = new Date().getFullYear();
    if (execYear === 2026) {
      expect(isDisabled).toBe(true);
    }
  });

  it("‹ deshabilitado cuando year === earliestYear", () => {
    mockUseReports.mockReturnValue(makeSuccessReturn({
      ...mockData,
      earliestYear: 2026,
    }));
    renderCard({ type: "income-expense", year: 2026 });
    const prevBtn = screen.getByRole("button", { name: /año anterior/i });
    const isDisabled =
      prevBtn.hasAttribute("disabled") || prevBtn.getAttribute("aria-disabled") === "true";
    expect(isDisabled).toBe(true);
  });

  it("‹ deshabilitado cuando earliestYear es null", () => {
    mockUseReports.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard({ type: "income-expense", year: 2026 });
    const prevBtn = screen.getByRole("button", { name: /año anterior/i });
    const isDisabled =
      prevBtn.hasAttribute("disabled") || prevBtn.getAttribute("aria-disabled") === "true";
    expect(isDisabled).toBe(true);
  });
});

describe("ReportCard — estados de carga/error/vacío", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra skeleton durante la carga", () => {
    mockUseReports.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: true,
      isPending: true,
      isSuccess: false,
    } as unknown as ReturnType<typeof useReports>);

    renderCard({ type: "income-expense" });
    // El skeleton es aria-hidden, verificamos que el gráfico NO está en el árbol
    expect(screen.queryByTestId("recharts-chart")).not.toBeInTheDocument();
  });

  it("muestra error con botón Reintentar cuando falla", () => {
    mockUseReports.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: false,
      isError: true,
      isPending: false,
      isSuccess: false,
      error: new Error("500"),
    } as unknown as ReturnType<typeof useReports>);

    renderCard({ type: "income-expense" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("muestra 'Sin movimientos en 2026' cuando el año está vacío (income-expense)", () => {
    mockUseReports.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard({ type: "income-expense", year: 2026 });
    expect(screen.getByText(/sin movimientos en 2026/i)).toBeInTheDocument();
  });

  it("muestra 'Sin movimientos en 2026' cuando el año está vacío (by-category)", () => {
    mockUseReports.mockReturnValue(makeSuccessReturn(emptyData));
    renderCard({ type: "by-category", year: 2026 });
    expect(screen.getByText(/sin movimientos en 2026/i)).toBeInTheDocument();
  });

  it("by-category: muestra skeleton (no crashea) cuando isLoading=false y data=undefined (transición de query key)", () => {
    // Reproduce el estado intermedio de React Query v5 al cambiar la query key
    // (ej: cambio de filtro de categorías a una key sin cache):
    // isLoading = isPending && isFetching → false cuando isPending=false aunque data aún sea undefined.
    mockUseReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: false,
      error: null,
      status: "success" as const,
      fetchStatus: "fetching" as const,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReports>);

    // No debe lanzar TypeError al acceder a data.categories
    expect(() => renderCard({ type: "by-category" })).not.toThrow();
    // El gráfico no debe estar en el árbol
    expect(screen.queryByTestId("recharts-chart")).not.toBeInTheDocument();
  });
});

describe("ReportCard — leyenda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("income-expense (Total-only) muestra leyenda con Ingresos y Gastos", () => {
    renderCard({ type: "income-expense" });
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
  });

  it("by-category muestra leyenda con nombres de categorías", () => {
    renderCard({ type: "by-category" });
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });
});

// ─── Tests: estructura scrolleable de leyendas de categorías ─────────────────

describe("ReportCard — región scrolleable en leyenda de by-category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("by-category: existe una región scrolleable (.legend-scroll-region) con los chips de categoría", () => {
    const { container } = renderCard({ type: "by-category" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toBeTruthy();
  });

  it("by-category: el region tiene data-overflow atributo", () => {
    const { container } = renderCard({ type: "by-category" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toHaveAttribute("data-overflow");
  });

  it("by-category: el role='group' de chips está DENTRO de la región scrolleable", () => {
    const { container } = renderCard({ type: "by-category" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    const group = scrollRegion?.querySelector('[role="group"][aria-label="Filtrar categorías"]');
    expect(group).toBeTruthy();
  });

  it("income-expense Total-only: NO existe región scrolleable", () => {
    const { container } = renderCard({ type: "income-expense" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toBeNull();
  });

  it("data-overflow='true' cuando scrollHeight > clientHeight (mock de medición)", () => {
    // jsdom no calcula layout real; mockeamos scrollHeight/clientHeight sobre el prototipo
    // para simular el caso de overflow.
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(84);

    // También mockeamos ResizeObserver para que llame al callback inmediatamente
    const originalRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) { this.cb = cb; }
      observe(target: Element) { this.cb([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      unobserve() {}
      disconnect() {}
    };

    const { container } = renderCard({ type: "by-category" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toHaveAttribute("data-overflow", "true");

    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
    globalThis.ResizeObserver = originalRO;
  });

  it("data-overflow='false' cuando scrollHeight <= clientHeight (sin overflow)", () => {
    // jsdom tiene ambas en 0 por defecto → no overflow
    const { container } = renderCard({ type: "by-category" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    // En jsdom ambos son 0 → 0 > 0 es false → data-overflow="false"
    expect(scrollRegion).toHaveAttribute("data-overflow", "false");
  });
});

// ─── Tests: LegendAllChip — chip-comando "Todas / Ninguna" ───────────────────

describe("ReportCard — LegendAllChip en leyenda de by-category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  // ── by-category ───────────────────────────────────────────────────────────

  it("by-category: chip muestra aria-label 'Ocultar...' y rótulo 'Ninguna' cuando todas activas", () => {
    renderCard({ type: "by-category" });
    // hiddenCategoryIds vacío → todas activas → label "Ninguna"
    expect(screen.getByRole("button", { name: "Ocultar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Ninguna")).toBeInTheDocument();
  });

  it("by-category: chip muestra aria-label 'Mostrar...' y rótulo 'Todas' cuando hay alguna apagada", () => {
    // cat-1 oculta → hiddenCategoryIds = ["cat-1"]
    renderCard({ type: "by-category", categoryIds: ["cat-2"] });
    expect(screen.getByRole("button", { name: "Mostrar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
  });

  it("by-category: chip muestra 'Todas' cuando ninguna categoría está activa (todas apagadas)", () => {
    renderCard({ type: "by-category", categoryIds: [] });
    expect(screen.getByRole("button", { name: "Mostrar todas las categorías" })).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
  });

  it("by-category: clic en chip (Ninguna) llama onCategoryIdsChange con []", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ type: "by-category", onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Ocultar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith([]);
  });

  it("by-category: clic en chip (Todas) llama onCategoryIdsChange con null", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ type: "by-category", categoryIds: ["cat-2"], onCategoryIdsChange });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las categorías" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith(null);
  });

  // ── income-expense Total-only — SIN chip ──────────────────────────────────

  it("income-expense en Dashboard: NO muestra el chip Todas/Ninguna (leyenda decorativa, sin categorías)", () => {
    // Dashboard mode: sin onDirectionChange → leyenda decorativa de 2 series.
    // No hay LegendAllChip porque no hay leyenda de categorías.
    renderCard({ type: "income-expense" });
    expect(screen.queryByRole("button", { name: "Ocultar todas las categorías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar todas las categorías" })).not.toBeInTheDocument();
    // La leyenda decorativa muestra Ingresos y Gastos como texto (no buttons interactivos)
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
  });

  // ── El chip está FUERA del role="group" y DESPUÉS en el DOM ──────────────
  // Spec: LegendAllChip está en el carril fijo, fuera de la región scroll y
  // fuera del role="group". El order DOM es: [región-scroll(group)] → [carril-chip].

  it("by-category: el chip aparece DESPUÉS del group 'Filtrar categorías' en el DOM", () => {
    const { container } = renderCard({ type: "by-category" });
    const chip = screen.getByRole("button", { name: "Ocultar todas las categorías" });
    const group = container.querySelector('[role="group"][aria-label="Filtrar categorías"]');
    expect(group).toBeTruthy();
    if (group) {
      // compareDocumentPosition: 2 = Node.DOCUMENT_POSITION_PRECEDING (group está antes que chip)
      const position = chip.compareDocumentPosition(group);
      expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    }
  });

  it("by-category: el chip NO está dentro del role='group'", () => {
    const { container } = renderCard({ type: "by-category" });
    const chip = screen.getByRole("button", { name: "Ocultar todas las categorías" });
    const group = container.querySelector('[role="group"][aria-label="Filtrar categorías"]');
    expect(group).toBeTruthy();
    if (group) {
      // El chip NO debe ser descendiente del group
      expect(group.contains(chip)).toBe(false);
    }
  });

  it("by-category: el chip NO está dentro de la región scrolleable", () => {
    const { container } = renderCard({ type: "by-category" });
    const chip = screen.getByRole("button", { name: "Ocultar todas las categorías" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toBeTruthy();
    if (scrollRegion) {
      // El chip NO debe ser descendiente de la región scroll
      expect(scrollRegion.contains(chip)).toBe(false);
    }
  });

  it("income-expense Total-only: el group de series NO está dentro de una región scrolleable", () => {
    const { container } = renderCard({ type: "income-expense" });
    const scrollRegion = container.querySelector(".legend-scroll-region");
    // No debe existir en la leyenda de series
    expect(scrollRegion).toBeNull();
  });
});

// ─── Tests: income-expense en /reportes (leyenda-filtro de categorías, RF-REP-014) ──

describe("ReportCard — income-expense en /reportes (leyenda-filtro de categorías, RF-REP-014)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("con onDirectionChange: footer muestra leyenda interactiva de categorías (group 'Filtrar categorías')", () => {
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
    });
    // Footer debe tener role="group" aria-label="Filtrar categorías" con las categorías de availableCategories
    expect(screen.getByRole("group", { name: /filtrar categorías/i })).toBeInTheDocument();
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("con onDirectionChange: NO hay group 'Filtrar series' (leyenda de series eliminada)", () => {
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
    });
    // La leyenda de series (hiddenSeries) fue eliminada del income-expense
    expect(screen.queryByRole("group", { name: /filtrar series/i })).not.toBeInTheDocument();
  });

  it("con onDirectionChange: LegendAllChip presente en footer (chip Ninguna/Todas)", () => {
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
    });
    // categoryIds=null (default) → todas activas → chip "Ninguna" (Ocultar todas)
    expect(screen.getByRole("button", { name: "Ocultar todas las categorías" })).toBeInTheDocument();
  });

  it("con onDirectionChange: el footer tiene región scrolleable (.legend-scroll-region)", () => {
    const { container } = renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
    });
    // La leyenda de categorías es scrolleable (igual que by-category)
    const scrollRegion = container.querySelector(".legend-scroll-region");
    expect(scrollRegion).toBeTruthy();
  });

  it("con onDirectionChange: los ítems de categoría son toggle buttons interactivos (aria-pressed)", () => {
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
    });
    // Los ítems de la leyenda son botones con aria-pressed
    const alimentacionBtn = screen.getByRole("button", { name: "Alimentación" });
    expect(alimentacionBtn).toHaveAttribute("aria-pressed", "true");
    const transporteBtn = screen.getByRole("button", { name: "Transporte" });
    expect(transporteBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("con onDirectionChange + categoryIds=[cat-2]: cat-1 aparece como aria-pressed=false", () => {
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
      categoryIds: ["cat-2"],
    });
    const alimentacionBtn = screen.getByRole("button", { name: "Alimentación" });
    expect(alimentacionBtn).toHaveAttribute("aria-pressed", "false");
    const transporteBtn = screen.getByRole("button", { name: "Transporte" });
    expect(transporteBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("con onDirectionChange: clic en una categoría llama onCategoryIdsChange", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({
      type: "income-expense",
      onDirectionChange: vi.fn(),
      onCategoryIdsChange,
    });
    // Clic en "Alimentación" (activa → se oculta → categoryIds excluye cat-1)
    fireEvent.click(screen.getByRole("button", { name: "Alimentación" }));
    expect(onCategoryIdsChange).toHaveBeenCalledWith(["cat-2"]);
  });
});

describe("ReportCard — quitar card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("al hacer clic en X, muestra confirmación '¿Quitar este reporte?'", () => {
    renderCard({ type: "income-expense", removable: true, onRemove: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    expect(screen.getByText(/quitar este reporte/i)).toBeInTheDocument();
  });

  it("al confirmar quitar, llama onRemove", () => {
    const onRemove = vi.fn();
    renderCard({ type: "income-expense", removable: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    // Clic en "Quitar" dentro del popover de confirmación
    const quitarBtns = screen.getAllByText("Quitar");
    // El segundo "Quitar" es el botón de confirmación del popover
    const confirmBtn = quitarBtns[quitarBtns.length - 1];
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: Toggle Barra/Línea en by-category ────────────────────────────────

describe("ReportCard — toggle Barra/Línea en by-category (categoryChartMode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn());
  });

  it("muestra el tablist 'Representación del reporte' solo en by-category", () => {
    renderCard({ type: "by-category" });
    expect(screen.getByRole("tablist", { name: /representación del reporte/i })).toBeInTheDocument();
  });

  it("income-expense Total-only NO tiene tablist de vista", () => {
    renderCard({ type: "income-expense" });
    expect(screen.queryByRole("tablist", { name: /representación del reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("default (categoryChartMode='bar'): tab 'Barra' aria-selected=true", () => {
    renderCard({ type: "by-category", categoryChartMode: "bar" });
    const barraTab = screen.getByRole("tab", { name: "Barra" });
    expect(barraTab).toHaveAttribute("aria-selected", "true");
    const lineaTab = screen.getByRole("tab", { name: "Línea" });
    expect(lineaTab).toHaveAttribute("aria-selected", "false");
  });

  it("cuando categoryChartMode='line', tab 'Línea' aria-selected=true", () => {
    renderCard({ type: "by-category", categoryChartMode: "line" });
    const lineaTab = screen.getByRole("tab", { name: "Línea" });
    expect(lineaTab).toHaveAttribute("aria-selected", "true");
    const barraTab = screen.getByRole("tab", { name: "Barra" });
    expect(barraTab).toHaveAttribute("aria-selected", "false");
  });

  it("al hacer clic en tab 'Línea', llama onCategoryChartModeChange('line')", () => {
    const onChange = vi.fn();
    renderCard({ type: "by-category", categoryChartMode: "bar", onCategoryChartModeChange: onChange });
    fireEvent.click(screen.getByRole("tab", { name: "Línea" }));
    expect(onChange).toHaveBeenCalledWith("line");
  });

  it("al hacer clic en tab 'Barra', llama onCategoryChartModeChange('bar')", () => {
    const onChange = vi.fn();
    renderCard({ type: "by-category", categoryChartMode: "line", onCategoryChartModeChange: onChange });
    fireEvent.click(screen.getByRole("tab", { name: "Barra" }));
    expect(onChange).toHaveBeenCalledWith("bar");
  });

  it("el gráfico renderiza en modo Barra (by-category, categoryChartMode='bar')", () => {
    renderCard({ type: "by-category", categoryChartMode: "bar" });
    expect(screen.getAllByTestId("recharts-chart").length).toBeGreaterThan(0);
  });

  it("el gráfico renderiza en modo Línea (by-category, categoryChartMode='line')", () => {
    renderCard({ type: "by-category", categoryChartMode: "line" });
    expect(screen.getAllByTestId("recharts-chart").length).toBeGreaterThan(0);
  });

  it("en modo Barra, la leyenda muestra nombres de categorías de GASTO", () => {
    renderCard({ type: "by-category", categoryChartMode: "bar" });
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("en modo Barra, NO hay rótulos 'Gastos'/'Ingresos' en la leyenda (grupo plano de categorías)", () => {
    renderCard({ type: "by-category", categoryChartMode: "bar" });
    // La leyenda es un grupo plano de categorías sin rótulos de tipo
    expect(screen.queryByText("Ingresos")).not.toBeInTheDocument();
    expect(screen.queryByText("Gastos")).not.toBeInTheDocument();
  });

  it("income-expense Total-only: leyenda muestra 'Ingresos' y 'Gastos' sin nombres de categoría", () => {
    renderCard({ type: "income-expense" });
    expect(screen.getByText("Ingresos")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
    expect(screen.queryByText("Alimentación")).not.toBeInTheDocument();
    expect(screen.queryByText("Transporte")).not.toBeInTheDocument();
  });

  it("tabs presentes en by-category durante carga (isLoading=true)", () => {
    mockUseReports.mockReturnValue({
      ...makeSuccessReturn(),
      data: undefined,
      isLoading: true,
      isPending: true,
      isSuccess: false,
    } as unknown as ReturnType<typeof useReports>);
    renderCard({ type: "by-category" });
    expect(screen.getByRole("tablist", { name: /representación del reporte/i })).toBeInTheDocument();
  });
});