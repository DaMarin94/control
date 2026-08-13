/**
 * Regresión QA visual — RF-REP-017, card `by-category` en representación LÍNEA
 * (`FormBChartInner`).
 *
 * Bug: al encender el toggle "Simulados", el contorno superior REAL del stack
 * (última categoría fusionada) perdía su stroke sólido `--expense` (se le
 * asignaba `var(--panel)`, el mismo tratamiento que un separador interno),
 * dejando SOLO el contorno punteado de la capa simulada visible — incluidos
 * los 12 meses del año, incluso los que tienen 0 aporte simulado. El spec
 * (docs/design.md §RF-REP-017) exige que el contorno real permanezca sólido
 * SIEMPRE (invariante estructural: "la composición del bloque real no cambia
 * al encender el toggle"); el punteado se apila ENCIMA, no en su reemplazo.
 *
 * Este archivo usa un mock de `recharts` que, a diferencia del de
 * report-card.test.tsx (Area → null), CAPTURA las props de `<Area>` en
 * atributos `data-*` para poder verificar el stroke real que recibiría cada
 * serie — sin resolver el layout real de Recharts en jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
      { id: "cat-3", name: "Viajes", color: "#9B6FD1", scope: "EXPENSE" },
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

vi.mock("@/hooks/use-simulations", () => ({
  useSimulations: vi.fn(() => ({
    data: {
      horizonEndMonth: "2027-02",
      simulations: [
        {
          id: "sim-1",
          categoryId: "cat-3",
          category: { id: "cat-3", name: "Viajes", color: "#9B6FD1", scope: "EXPENSE" },
          monthsWithData: 6,
          paused: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    isLoading: false,
  })),
}));

// Recharts CAPTURADOR: a diferencia de report-card.test.tsx, expone las props
// reales de stroke/strokeWidth/strokeDasharray de cada <Area> en atributos
// data-* para poder verificar el DOM real (no solo que renderice).
vi.mock("recharts", () => {
  const React = require("react");
  const MockChart = ({ children, data }: { children?: ReactNode; data?: unknown[] }) =>
    React.createElement("div", { "data-testid": "recharts-chart", "data-points": data?.length }, children);
  const MockArea = ({
    dataKey,
    stroke,
    strokeWidth,
    strokeDasharray,
  }: {
    dataKey?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }) =>
    React.createElement("div", {
      "data-testid": `area-${dataKey ?? "unknown"}`,
      "data-stroke": stroke,
      "data-stroke-width": strokeWidth,
      "data-dasharray": strokeDasharray,
    });
  const MockXAxis = () => null;
  const MockYAxis = () => null;
  const MockCartesianGrid = () => null;
  const MockTooltip = () => null;
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) =>
    React.createElement("div", { "data-testid": "responsive-container" }, children);

  return {
    AreaChart: MockChart,
    BarChart: MockChart,
    Area: MockArea,
    Bar: () => null,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
    ResponsiveContainer: MockResponsiveContainer,
    Cell: () => null,
  };
});

import { useReports } from "@/hooks/use-reports";
import { ReportCard } from "@/components/charts/report-card";

const mockUseReports = vi.mocked(useReports);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

// cat-1/cat-2: categorías reales con gasto en Ene–Jun (índices 0–5), 0 el resto.
// cat-3: SOLO aporta vía simulación (ausente de `categories`/hasExpense=false),
// con aporte simulado únicamente en Sep (índice 8) — el resto del año (incluidos
// TODOS los meses pasados) es `null` (sin aporte). Al fusionar, cat-3 queda
// última en `mergedCategories` (RF-REP-017: real ∪ simulado, reales primero) →
// es la serie TOPE del stack, la que reproduce el defecto de QA.
const mockDataWithSimulated: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: i < 6 ? 20000 : 0,
  })),
  categories: [
    {
      categoryId: "cat-1",
      name: "Alimentación",
      color: "#4F86C6",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => (i < 6 ? 10000 : 0)),
    },
    {
      categoryId: "cat-2",
      name: "Transporte",
      color: "#E07B54",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => (i < 6 ? 10000 : 0)),
    },
  ],
  availableCategories: [
    { categoryId: "cat-1", name: "Alimentación", color: "#4F86C6", hasExpense: true, hasIncome: false },
    { categoryId: "cat-2", name: "Transporte", color: "#E07B54", hasExpense: true, hasIncome: false },
    { categoryId: "cat-3", name: "Viajes", color: "#9B6FD1", hasExpense: false, hasIncome: false },
  ],
  earliestYear: 2025,
  simulated: {
    months: Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}`,
      incomeCents: 0,
      expenseCents: i === 8 ? 5000 : 0,
    })),
    categories: [
      {
        categoryId: "cat-3",
        name: "Viajes",
        color: "#9B6FD1",
        monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => (i === 8 ? 5000 : null)),
      },
    ],
  },
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function renderCard(props: Partial<React.ComponentProps<typeof ReportCard>> = {}) {
  return render(
    <ReportCard
      type="by-category"
      year={2026}
      chartHeight={300}
      categoryChartMode="line"
      onIncludeSimulatedChange={vi.fn()}
      {...props}
    />,
    { wrapper: createWrapper() },
  );
}

// `ChartResponsiveArea` monta el gráfico DOS veces (variante desktop @wide y
// variante compacta @max-wide, docs/design.md §Contención responsive) — ambas
// reciben las mismas props de serie, así que basta con la primera para
// verificar el stroke; helper para no repetir `getAllByTestId(...)[0]`.
function firstByTestId(testId: string) {
  return screen.getAllByTestId(testId)[0];
}

/**
 * Primer contenedor `<AreaChart>` (variante desktop de `ChartResponsiveArea`) —
 * para verificar ORDEN DE PINTADO (posición en el DOM), no solo atributos.
 * En SVG, orden de documento = orden de pintado (los últimos hermanos se
 * pintan encima) — un test que solo mire `data-stroke`/`data-dasharray` no
 * puede detectar que una capa posterior tapa a una anterior aunque ambas
 * tengan el atributo "correcto" (esto fue exactamente lo que un test previo,
 * solo-de-atributos, no detectó).
 */
function firstChart() {
  return screen.getAllByTestId("recharts-chart")[0];
}

/** data-testid de todas las <Area> del primer chart, en orden de pintado real. */
function areaOrder() {
  return Array.from(firstChart().querySelectorAll<HTMLElement>('[data-testid^="area-"]')).map(
    (el) => el.dataset.testid,
  );
}

function makeSuccessReturn(data: ReportsMovementsResponse) {
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

describe("FormBChartInner (Línea, by-category) — contorno real vs. capa simulada (RF-REP-017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn(mockDataWithSimulated));
  });

  it("toggle APAGADO: cat-3 (solo-simulada) no entra al merge; la serie tope real es cat-2, con contorno sólido --expense 2px", () => {
    renderCard({ includeSimulated: false });
    // Con el toggle apagado, cat-3 (sin gasto real, solo aporte simulado) queda
    // fuera de `mergedCategories` (RF-REP-017: la capa simulada no se fusiona) →
    // el tope del stack real es cat-2, la última categoría real.
    expect(screen.queryAllByTestId("area-cat-3").length).toBe(0);
    const topReal = firstByTestId("area-cat-2");
    expect(topReal).toHaveAttribute("data-stroke", "var(--expense)");
    expect(topReal).toHaveAttribute("data-stroke-width", "2");
    expect(topReal.getAttribute("data-dasharray")).toBeFalsy();
  });

  it("toggle ENCENDIDO: la serie tope REAL (cat-3) conserva el MISMO contorno sólido --expense 2px que con el toggle apagado — no lo pierde ni pasa a punteado", () => {
    renderCard({ includeSimulated: true });
    const topReal = firstByTestId("area-cat-3");
    // Criterio de aceptación 1 y 3: la composición del bloque real NO cambia al
    // encender el toggle. Antes del fix, este stroke caía a "var(--panel)"
    // (tratamiento de separador interno) y la línea sólida desaparecía del
    // DOM — dejando SOLO el contorno punteado visible en los 12 meses.
    expect(topReal).toHaveAttribute("data-stroke", "var(--expense)");
    expect(topReal).toHaveAttribute("data-stroke-width", "2");
    // El Area REAL nunca lleva strokeDasharray — el punteado vive en la capa
    // simulada, apilada encima (no en reemplazo).
    expect(topReal.getAttribute("data-dasharray")).toBeFalsy();
  });

  it("toggle ENCENDIDO: la capa SIMULADA tope (sim__cat-3) agrega su propio contorno punteado --expense 2px, encima del sólido real (no en su lugar)", () => {
    renderCard({ includeSimulated: true });
    const topSim = firstByTestId("area-sim__cat-3");
    expect(topSim).toHaveAttribute("data-stroke", "var(--expense)");
    expect(topSim).toHaveAttribute("data-stroke-width", "2");
    expect(topSim).toHaveAttribute("data-dasharray", "5 4");
    // Y el sólido real sigue presente en el mismo render (dos líneas rojas
    // coexistiendo, como describe el spec) — no es que una reemplaza a la otra.
    const topReal = firstByTestId("area-cat-3");
    expect(topReal).toHaveAttribute("data-stroke", "var(--expense)");
  });

  it("toggle ENCENDIDO: las series NO-tope (cat-1, cat-2) siguen con el separador --panel 1px, sin punteado — el fix no las toca", () => {
    renderCard({ includeSimulated: true });
    for (const key of ["area-cat-1", "area-cat-2"]) {
      const el = firstByTestId(key);
      expect(el).toHaveAttribute("data-stroke", "var(--panel)");
      expect(el).toHaveAttribute("data-stroke-width", "1");
    }
    for (const key of ["area-sim__cat-1", "area-sim__cat-2"]) {
      const el = firstByTestId(key);
      expect(el).toHaveAttribute("data-stroke", "var(--panel)");
      expect(el.getAttribute("data-dasharray")).toBeFalsy();
    }
  });
});

/**
 * Regresión QA visual — segunda vuelta. El fix anterior (stroke correcto en
 * `area-cat-3`) no alcanzaba: `area-sim__cat-3` (tope simulado) comparte
 * `stackId="expense"` con TODO el bloque real, así que en los meses (o, para
 * una categoría que nunca se simula, el AÑO ENTERO) sin aporte propio, los
 * separadores `--panel` de las capas simuladas intermedias degeneran a la
 * misma posición del contorno real y se pintan DESPUÉS de él en el documento
 * — lo tapan. Un test que solo mira atributos (`data-stroke`) no detecta esto:
 * el atributo de `area-cat-3` ya era correcto y el defecto persistía igual.
 * El fix real agrega un contorno "de seguridad" (`area-expenseCents`, mismo
 * dataKey que `chartData` ya expone, SIN stackId) como el ÚLTIMO hijo del
 * árbol — pinta por encima de cualquier separador del bloque simulado.
 */
describe("FormBChartInner (Línea, by-category) — contorno de seguridad del total real (fix de oclusión)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReports.mockReturnValue(makeSuccessReturn(mockDataWithSimulated));
  });

  it("toggle APAGADO: no se monta ningún contorno de seguridad — cero impacto con el toggle apagado", () => {
    renderCard({ includeSimulated: false });
    expect(screen.queryAllByTestId("area-expenseCents").length).toBe(0);
  });

  it("toggle ENCENDIDO: se monta el contorno de seguridad del total real, sólido --expense 2px, sin dasharray", () => {
    renderCard({ includeSimulated: true });
    const safety = firstByTestId("area-expenseCents");
    expect(safety).toHaveAttribute("data-stroke", "var(--expense)");
    expect(safety).toHaveAttribute("data-stroke-width", "2");
    expect(safety.getAttribute("data-dasharray")).toBeFalsy();
  });

  it("toggle ENCENDIDO: el contorno de seguridad es el ÚLTIMO elemento pintado del stack — encima de TODO el bloque simulado, incluida su capa tope punteada (esto es lo que evita la oclusión, no solo el atributo)", () => {
    renderCard({ includeSimulated: true });
    const order = areaOrder();
    // El contorno de seguridad cierra el árbol: nada se pinta después de él.
    expect(order[order.length - 1]).toBe("area-expenseCents");
    // Y específicamente pinta después de la capa que causaba la oclusión: el
    // separador --panel de las capas simuladas intermedias (cat-1/cat-2, sin
    // aporte todo el año) y el punteado de la capa simulada tope (cat-3).
    const safetyIdx = order.indexOf("area-expenseCents");
    const simTopIdx = order.indexOf("area-sim__cat-3");
    const simMidIdx1 = order.indexOf("area-sim__cat-1");
    const simMidIdx2 = order.indexOf("area-sim__cat-2");
    expect(safetyIdx).toBeGreaterThan(simTopIdx);
    expect(safetyIdx).toBeGreaterThan(simMidIdx1);
    expect(safetyIdx).toBeGreaterThan(simMidIdx2);
  });
});
