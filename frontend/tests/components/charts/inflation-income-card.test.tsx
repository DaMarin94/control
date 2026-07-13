/**
 * Tests de InflationIncomeCard (Ola 4, P5 — gráfico de líneas Inflación vs Ingresos).
 *
 * Verifica:
 * - Render del canvas con las 3 series de dato y las 2 tendencias desde `points`
 * - Meses futuros: la línea termina (null → connectNulls=false, no interpolado)
 * - Estado vacío (todos los datos son null): overlay "Sin datos en {año}."
 * - Estado de carga: skeleton con role="status"
 * - Estado de error: AlertTriangle + "No se pudo cargar" + botón Reintentar
 * - Leyenda de series: 3 ítems toggle (Inflación, Ingresos nominal, Ingresos ajustado)
 * - Las tendencias NO son ítems de leyenda
 * - Filtro de categorías: chips-toggle (ChartLegend scrollable)
 * - Hook useInflationIncome llamado con parámetros correctos
 * - Cabecera: título editable, YearStepper con earliestYear, selector de moneda, botón quitar
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnnualInflationIncomeResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useInflationIncome: vi.fn(),
  INFLATION_INCOME_QUERY_KEY: (year: number, key: string | null) => ["reports-inflation-income", year, key],
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

// Mock de useLimits (P2 — Tramo 2): [] = cero impacto, no afecta los tests existentes.
// Ver inflation-income-card-limits.test.tsx para los tests dedicados de marca visual pasiva.
vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(() => ({
    limits: [],
    isLoading: false,
    isSaving: false,
    create: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
  })),
}));

// Mock de useCategories (P2 — popover informativo de límites): resuelve nombre/color
// de categoría para el refinamiento de límites. [] no afecta los tests existentes.
vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({ categories: [], isLoading: false, isError: false })),
}));

// Mock de Recharts para que los tests no fallen por SVG/ResponsiveContainer
vi.mock("recharts", () => {
  const React = require("react");
  const MockChart = ({ children, data }: { children?: ReactNode; data?: unknown[] }) =>
    React.createElement("div", { "data-testid": "recharts-line-chart", "data-points": data?.length }, children);
  const MockLine = ({ dataKey, strokeDasharray, strokeOpacity }: { dataKey?: string; strokeDasharray?: string; strokeOpacity?: number }) =>
    React.createElement("div", {
      "data-testid": `line-${dataKey ?? "unknown"}`,
      "data-dasharray": strokeDasharray,
      "data-opacity": strokeOpacity,
    });
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) =>
    React.createElement("div", { "data-testid": "responsive-container" }, children);

  return {
    LineChart: MockChart,
    Line: MockLine,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ResponsiveContainer: MockResponsiveContainer,
  };
});

import { useInflationIncome } from "@/hooks/use-reports";
import { InflationIncomeCard } from "@/components/charts/inflation-income-card";

const mockUseInflationIncome = vi.mocked(useInflationIncome);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

/** 12 meses de inflación e ingresos con datos en los primeros 6 (meses futuros null en 7–12). */
function buildMonths(futureCutoff = 12): AnnualInflationIncomeResponse["months"] {
  return Array.from({ length: 12 }, (_, i) => ({
    inflationPct: i < futureCutoff ? 3.5 + i * 0.2 : null,
    incomePct: i < futureCutoff ? 2.1 + i * 0.3 : null,
    incomePctAdj: i < futureCutoff ? -1.4 + i * 0.1 : null,
  }));
}

const mockTrendPoints = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5];
const mockAdjTrendPoints = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];

const mockData: AnnualInflationIncomeResponse = {
  year: 2026,
  currency: "ARS",
  months: buildMonths(),
  incomeTrend: {
    slope: 0.5,
    intercept: 1,
    points: mockTrendPoints,
  },
  incomeAdjTrend: {
    slope: 0.2,
    intercept: -1,
    points: mockAdjTrendPoints,
  },
  earliestYear: 2024,
  availableCategories: [
    { categoryId: "cat-1", name: "Sueldo", color: "#4F86C6" },
    { categoryId: "cat-2", name: "Freelance", color: "#E07B54" },
  ],
};

/** Datos con meses futuros: solo los primeros 6 tienen dato. */
const mockDataWithFuture: AnnualInflationIncomeResponse = {
  ...mockData,
  months: buildMonths(6),
};

/** Datos vacíos: todos los meses son null. */
const mockDataEmpty: AnnualInflationIncomeResponse = {
  ...mockData,
  months: buildMonths(0),
  incomeTrend: { slope: 0, intercept: 0, points: null },
  incomeAdjTrend: { slope: 0, intercept: 0, points: null },
  availableCategories: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function mockHookWithData(data: AnnualInflationIncomeResponse) {
  mockUseInflationIncome.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as ReturnType<typeof useInflationIncome>);
}

function mockHookLoading() {
  mockUseInflationIncome.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    isPending: true,
    isSuccess: false,
    error: null,
    status: "pending",
    fetchStatus: "fetching",
    refetch: vi.fn(),
  } as ReturnType<typeof useInflationIncome>);
}

function mockHookError(refetch = vi.fn()) {
  mockUseInflationIncome.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    isPending: false,
    isSuccess: false,
    error: new Error("Network error"),
    status: "error",
    fetchStatus: "idle",
    refetch,
  } as ReturnType<typeof useInflationIncome>);
}

function renderCard(props: Partial<React.ComponentProps<typeof InflationIncomeCard>> = {}) {
  return render(
    <InflationIncomeCard
      year={2026}
      titlePlaceholder="Reporte 1"
      {...props}
    />,
    { wrapper: createWrapper() },
  );
}

// ─── Tests: estados de carga ───────────────────────────────────────────────────

describe("InflationIncomeCard — estado de carga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookLoading();
  });

  it("muestra skeleton con role='status' y aria-label de carga", () => {
    renderCard();
    expect(screen.getByRole("status", { name: /cargando/i })).toBeInTheDocument();
  });

  it("NO muestra el gráfico mientras carga", () => {
    renderCard();
    expect(screen.queryByTestId("recharts-line-chart")).not.toBeInTheDocument();
  });

  it("muestra la cabecera con el placeholder de título durante la carga", () => {
    renderCard({ titlePlaceholder: "Reporte 1" });
    // El título placeholder se muestra en la cabecera (botón o texto)
    expect(screen.getByText("Reporte 1")).toBeInTheDocument();
  });
});

// ─── Tests: estado de error ────────────────────────────────────────────────────

describe("InflationIncomeCard — estado de error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra 'No se pudo cargar el reporte.'", () => {
    mockHookError();
    renderCard();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("No se pudo cargar el reporte.")).toBeInTheDocument();
  });

  it("muestra el botón Reintentar y lo hace funcionar", () => {
    const refetch = vi.fn();
    mockHookError(refetch);
    renderCard();
    const btn = screen.getByRole("button", { name: /reintentar/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("InflationIncomeCard — botón de refrescar per-card (P5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("está presente sin depender de removable", () => {
    mockHookWithData(mockData);
    renderCard({ removable: false });
    expect(screen.getByRole("button", { name: /actualizar reporte/i })).toBeInTheDocument();
  });

  it("al hacer clic, llama a refetch", () => {
    const refetch = vi.fn();
    mockUseInflationIncome.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "idle",
      refetch,
    } as ReturnType<typeof useInflationIncome>);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /actualizar reporte/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se deshabilita y marca aria-busy mientras isFetching=true", () => {
    mockUseInflationIncome.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "fetching",
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInflationIncome>);
    renderCard();
    const btn = screen.getByRole("button", { name: /actualizar reporte/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

// ─── Tests: estado vacío ───────────────────────────────────────────────────────

describe("InflationIncomeCard — estado vacío (sin datos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockDataEmpty);
  });

  it("muestra overlay 'Sin datos en {año}.'", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("Sin datos en 2026.")).toBeInTheDocument();
  });

  it("muestra el gráfico (canvas existe aunque sin series)", () => {
    renderCard();
    expect(screen.getByTestId("recharts-line-chart")).toBeInTheDocument();
  });
});

// ─── Tests: render de las series ──────────────────────────────────────────────

describe("InflationIncomeCard — series y tendencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("renderiza la serie de inflación (dataKey='inflation')", () => {
    renderCard();
    expect(screen.getByTestId("line-inflation")).toBeInTheDocument();
  });

  it("renderiza la serie de ingresos nominal (dataKey='income')", () => {
    renderCard();
    expect(screen.getByTestId("line-income")).toBeInTheDocument();
  });

  it("renderiza la serie de ingresos ajustada (dataKey='incomeAdj') con dasharray '6 4'", () => {
    renderCard();
    const lineAdj = screen.getByTestId("line-incomeAdj");
    expect(lineAdj).toBeInTheDocument();
    expect(lineAdj).toHaveAttribute("data-dasharray", "6 4");
  });

  it("renderiza la tendencia de ingresos nominal (dataKey='trendIncome') cuando points no es null", () => {
    renderCard();
    expect(screen.getByTestId("line-trendIncome")).toBeInTheDocument();
  });

  it("renderiza la tendencia de ingresos ajustada (dataKey='trendIncomeAdj') cuando points no es null", () => {
    renderCard();
    expect(screen.getByTestId("line-trendIncomeAdj")).toBeInTheDocument();
  });

  it("las tendencias llevan dasharray '2 3' y opacidad 0.45", () => {
    renderCard();
    const trendNominal = screen.getByTestId("line-trendIncome");
    const trendAdj = screen.getByTestId("line-trendIncomeAdj");
    expect(trendNominal).toHaveAttribute("data-dasharray", "2 3");
    expect(trendAdj).toHaveAttribute("data-dasharray", "2 3");
    expect(trendNominal).toHaveAttribute("data-opacity", "0.45");
    expect(trendAdj).toHaveAttribute("data-opacity", "0.45");
  });
});

// ─── Tests: meses futuros (null) ──────────────────────────────────────────────

describe("InflationIncomeCard — meses futuros cortan la línea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockDataWithFuture);
  });

  it("renderiza el gráfico con datos parciales (sin overlay vacío)", () => {
    renderCard();
    expect(screen.getByTestId("recharts-line-chart")).toBeInTheDocument();
    // No vacío: hay datos en al menos 6 meses
    expect(screen.queryByText("Sin datos en 2026.")).not.toBeInTheDocument();
  });

  it("las líneas usan los datos del hook (con null en meses futuros)", () => {
    renderCard();
    // El gráfico se renderiza — las líneas son responsabilidad de Recharts + connectNulls=false
    expect(screen.getByTestId("line-inflation")).toBeInTheDocument();
    expect(screen.getByTestId("line-income")).toBeInTheDocument();
    expect(screen.getByTestId("line-incomeAdj")).toBeInTheDocument();
  });
});

// ─── Tests: tendencias ausentes cuando points=null ────────────────────────────

describe("InflationIncomeCard — tendencias NO se dibujan con points=null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const dataNoTrend: AnnualInflationIncomeResponse = {
      ...mockData,
      incomeTrend: { slope: 0, intercept: 0, points: null },
      incomeAdjTrend: { slope: 0, intercept: 0, points: null },
    };
    mockHookWithData(dataNoTrend);
  });

  it("NO renderiza la línea de tendencia nominal", () => {
    renderCard();
    expect(screen.queryByTestId("line-trendIncome")).not.toBeInTheDocument();
  });

  it("NO renderiza la línea de tendencia ajustada", () => {
    renderCard();
    expect(screen.queryByTestId("line-trendIncomeAdj")).not.toBeInTheDocument();
  });
});

// ─── Tests: leyenda de series ─────────────────────────────────────────────────

describe("InflationIncomeCard — leyenda de 3 series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra los 3 ítems toggle de leyenda", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /filtrar series/i });
    expect(group).toBeInTheDocument();
    // 3 botones de toggle dentro del grupo
    const toggles = group.querySelectorAll("button");
    expect(toggles).toHaveLength(3);
  });

  it("la leyenda tiene ítem 'Inflación'", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /inflaci/i })).toBeInTheDocument();
  });

  it("la leyenda tiene ítem 'Ingresos (nominal)'", () => {
    renderCard();
    expect(screen.getByText("Ingresos (nominal)")).toBeInTheDocument();
  });

  it("la leyenda tiene ítem 'Ingresos (ajustado)'", () => {
    renderCard();
    expect(screen.getByText("Ingresos (ajustado)")).toBeInTheDocument();
  });

  it("los ítems de leyenda tienen aria-pressed=true por defecto", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /filtrar series/i });
    const buttons = group.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("al togglear 'Inflación', ese botón pasa a aria-pressed=false", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /filtrar series/i });
    const inflacionBtn = Array.from(group.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Inflación"),
    )!;
    expect(inflacionBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(inflacionBtn);
    expect(inflacionBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("al apagar 'Ingresos (nominal)', la tendencia nominal deja de renderizarse", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /filtrar series/i });
    const incomeBtn = Array.from(group.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("nominal"),
    )!;
    // Antes del toggle: tendencia presente
    expect(screen.getByTestId("line-trendIncome")).toBeInTheDocument();
    fireEvent.click(incomeBtn);
    // Después del toggle: tendencia oculta (sigue a su serie madre)
    expect(screen.queryByTestId("line-trendIncome")).not.toBeInTheDocument();
  });
});

// ─── Tests: filtro de categorías ──────────────────────────────────────────────

describe("InflationIncomeCard — filtro de categorías", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra chips de categorías disponibles", () => {
    renderCard();
    expect(screen.getByText("Sueldo")).toBeInTheDocument();
    expect(screen.getByText("Freelance")).toBeInTheDocument();
  });

  it("al togglear una categoría llama a onCategoryIdsChange", () => {
    const onCategoryIdsChange = vi.fn();
    renderCard({ onCategoryIdsChange });
    // El grupo de categorías tiene role="group" con label "Filtrar categorías de ingreso"
    const catGroup = screen.getByRole("group", { name: /filtrar categor/i });
    const sueldoBtn = catGroup.querySelector("button")!;
    fireEvent.click(sueldoBtn);
    expect(onCategoryIdsChange).toHaveBeenCalledTimes(1);
  });

  it("NO muestra filtro de categorías cuando availableCategories está vacío", () => {
    mockHookWithData(mockDataEmpty);
    renderCard();
    // Sin categorías disponibles, no se monta el ChartLegend de categorías
    expect(screen.queryByRole("group", { name: /filtrar categor/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: cabecera ──────────────────────────────────────────────────────────

describe("InflationIncomeCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra el stepper de año con el año pedido", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("el botón ‹ está deshabilitado cuando year === earliestYear", () => {
    renderCard({ year: 2024 }); // earliestYear=2024 en mockData
    const prevBtn = screen.getByRole("button", { name: /año anterior/i });
    expect(prevBtn).toBeDisabled();
  });

  it("el botón ‹ está habilitado cuando year > earliestYear", () => {
    renderCard({ year: 2026 }); // earliestYear=2024
    const prevBtn = screen.getByRole("button", { name: /año anterior/i });
    expect(prevBtn).not.toBeDisabled();
  });

  it("al hacer clic en ‹ llama a onYearChange con year-1", () => {
    const onYearChange = vi.fn();
    renderCard({ year: 2026, onYearChange });
    fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
    expect(onYearChange).toHaveBeenCalledWith(2025);
  });

  it("muestra el placeholder de título cuando no hay título propio", () => {
    renderCard({ titlePlaceholder: "Reporte 3" });
    expect(screen.getByText("Reporte 3")).toBeInTheDocument();
  });

  it("muestra el título propio cuando se proporciona", () => {
    renderCard({ title: "Mi inflación", titlePlaceholder: "Reporte 1" });
    expect(screen.getByText("Mi inflación")).toBeInTheDocument();
  });

  it("muestra el botón quitar cuando removable=true", () => {
    renderCard({ removable: true, onRemove: vi.fn() });
    expect(screen.getByRole("button", { name: /quitar reporte/i })).toBeInTheDocument();
  });

  it("NO muestra el botón quitar cuando removable=false", () => {
    renderCard({ removable: false });
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: hook llamado con parámetros correctos ─────────────────────────────

describe("InflationIncomeCard — parámetros del hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookLoading();
  });

  it("llama a useInflationIncome con el año, categoryIds y currency correctos", () => {
    renderCard({
      year: 2025,
      categoryIds: ["cat-1"],
      currency: "USD",
    });
    expect(mockUseInflationIncome).toHaveBeenCalledWith(
      2025,
      ["cat-1"],
      "USD",
      expect.any(String), // today: YYYY-MM-DD
    );
  });

  it("llama a useInflationIncome con categoryIds=null cuando no se filtra", () => {
    renderCard({ year: 2026, categoryIds: null });
    expect(mockUseInflationIncome).toHaveBeenCalledWith(
      2026,
      null,
      undefined, // currency no pasada
      expect.any(String),
    );
  });
});
