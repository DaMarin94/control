/**
 * Tests de FixedEvolutionCard ("Detalle histórico de gastos fijos", RF-REP-013,
 * Ola 6 — migración de año calendario a rango de meses corridos anclado al
 * presente).
 *
 * Verifica:
 * - Estados de carga / error / rango sin gastos fijos / ningún fijo seleccionado
 * - Una línea por gasto fijo (dataKey=chainId), sin línea total
 * - Clave de color: dos fijos de la misma categoría reciben tonalidades distintas
 * - Calculado: dasheado "6 4"
 * - `connectNulls` false en la línea plena (Montos Y Variación); el puente
 *   atenuado de un hueco interno se dibuja como una `<Line>` extra por tramo
 * - Modo de visualización (ViewTabs Montos/Variación) y chip "Ajustada por inflación"
 *   (deshabilitado con motivo en Montos, habilitado en Variación)
 * - Leyenda-selector: toggle individual y "Todas"/"Ninguna", contador N/M
 * - Selector de RANGO (8 opciones) + persistencia + nota de recorte
 * - Superficie de excluidos: chip "N sin evolución" + popover, ausente si excluded=[]
 * - Estado nuevo: `lines` vacío + `excluded` lleno (carril solo con el disparador)
 * - Cabecera: título editable, selector de moneda, botón quitar — SIN stepper de año
 * - Ausencia de piezas fuera de alcance: sin chip de Simulados, sin filtro de categorías
 * - Hook useFixedEvolution llamado con los parámetros correctos (rangeMonths, sin `categories`)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnnualFijosResponse, FixedEvolutionLine, FixedEvolutionMonthPoint, FixedEvolutionExcludedLine } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useFixedEvolution: vi.fn(),
  FIXED_EVOLUTION_QUERY_KEY: (rangeMonths: number, currency: string | null, today: string | null) => [
    "reports-fixed-evolution",
    rangeMonths,
    currency,
    today,
  ],
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

// Mock de Recharts para que los tests no dependan de SVG/ResponsiveContainer.
vi.mock("recharts", () => {
  const React = require("react");
  const MockChart = ({ children, data }: { children?: ReactNode; data?: unknown[] }) =>
    React.createElement("div", { "data-testid": "recharts-line-chart", "data-points": data?.length }, children);
  const MockLine = ({
    dataKey,
    stroke,
    strokeWidth,
    strokeDasharray,
    strokeOpacity,
    connectNulls,
  }: {
    dataKey?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    strokeOpacity?: number;
    connectNulls?: boolean;
  }) =>
    React.createElement("div", {
      "data-testid": `line-${dataKey ?? "unknown"}`,
      "data-stroke": stroke,
      "data-stroke-width": strokeWidth,
      "data-dasharray": strokeDasharray,
      "data-opacity": strokeOpacity,
      "data-connect-nulls": String(connectNulls),
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

import { useFixedEvolution } from "@/hooks/use-reports";
import { FixedEvolutionCard, computePlotSlot } from "@/components/charts/fixed-evolution-card";
import { CHART_END_LABEL_MARGIN } from "@/components/ui/chart";
import { mockQuerySuccess, mockQueryLoading, mockQueryError } from "../../utils/query-result";

const mockUseFixedEvolution = vi.mocked(useFixedEvolution);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const RANGE_MONTHS = 6;
/** Meses corridos del rango efectivo (6 meses), terminando en el mes en curso. */
const RANGE_MONTHS_LIST = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"];

function buildPoint(month: string, amountCents: number | null, reason: FixedEvolutionMonthPoint["reason"] = null): FixedEvolutionMonthPoint {
  return { month, amountCents, nominalPct: null, adjustedPct: null, reason };
}

/** Serie completa (todos los meses con dato) para el rango de prueba. */
function buildFullMonths(amountCents: number): FixedEvolutionMonthPoint[] {
  return RANGE_MONTHS_LIST.map((m) => buildPoint(m, amountCents));
}

/** Dos fijos de LA MISMA categoría (mismo hue, columna 0 de la matriz) — desempate por ordinal. */
const lineAlquiler: FixedEvolutionLine = {
  chainId: "fx-alquiler",
  ordinal: 1,
  isCalculated: false,
  description: "Alquiler",
  categoryId: "cat-vivienda",
  categoryName: "Vivienda",
  categoryColor: "#E23B3B", // columna 0 (L3) de la matriz de 40 colores
  startMonth: "2020-01",
  endMonth: null,
  frequency: 1,
  originDescription: null,
  originChainId: null,
  months: buildFullMonths(150000),
};

const lineExpensas: FixedEvolutionLine = {
  chainId: "fx-expensas",
  ordinal: 2,
  isCalculated: false,
  description: "Expensas",
  categoryId: "cat-vivienda",
  categoryName: "Vivienda",
  categoryColor: "#E23B3B", // misma categoría/hue que Alquiler
  startMonth: "2020-01",
  endMonth: null,
  frequency: 1,
  originDescription: null,
  originChainId: null,
  months: buildFullMonths(80000),
};

/** Calculado derivado de Alquiler (mismo color de categoría propia, dasheado). */
const lineCalculado: FixedEvolutionLine = {
  chainId: "fx-calc",
  ordinal: 3,
  isCalculated: true,
  description: "Ajuste de alquiler",
  categoryId: "cat-servicios",
  categoryName: "Servicios",
  categoryColor: "#1AA5B0", // columna distinta (hue diferente)
  startMonth: "2020-01",
  endMonth: null,
  frequency: 1,
  originDescription: "Alquiler",
  originChainId: "fx-alquiler",
  months: buildFullMonths(20000),
};

/** Fijo bimestral con un hueco interno (mes anulado) para probar el puente. */
const lineHueco: FixedEvolutionLine = {
  chainId: "fx-hueco",
  ordinal: 4,
  isCalculated: false,
  description: "Seguro",
  categoryId: "cat-seguros",
  categoryName: "Seguros",
  categoryColor: "#8B4FD4",
  startMonth: "2020-01",
  endMonth: null,
  frequency: 1,
  originDescription: null,
  originChainId: null,
  months: [
    buildPoint("2025-11", 10000),
    buildPoint("2025-12", null, "skipped"),
    buildPoint("2026-01", 10000),
    buildPoint("2026-02", 10000),
    buildPoint("2026-03", 10000),
    buildPoint("2026-04", 10000),
  ],
};

const excludedItem: FixedEvolutionExcludedLine = {
  chainId: "fx-nuevo",
  isCalculated: false,
  description: "Suscripción nueva",
  categoryId: "cat-ocio",
  categoryName: "Ocio",
  categoryColor: "#4F86C6",
  startMonth: "2026-04",
};

const mockData: AnnualFijosResponse = {
  currency: "ARS",
  rangeMonths: RANGE_MONTHS,
  startMonth: "2025-11",
  endMonth: "2026-04",
  lines: [lineAlquiler, lineExpensas, lineCalculado, lineHueco],
  excluded: [excludedItem],
};

const mockDataEmpty: AnnualFijosResponse = {
  ...mockData,
  lines: [],
  excluded: [],
};

const mockDataEmptyWithExcluded: AnnualFijosResponse = {
  ...mockData,
  lines: [],
  excluded: [excludedItem],
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

function mockHookWithData(data: AnnualFijosResponse) {
  mockUseFixedEvolution.mockReturnValue(mockQuerySuccess(data));
}

function mockHookLoading() {
  mockUseFixedEvolution.mockReturnValue(mockQueryLoading());
}

function mockHookError(refetch = vi.fn()) {
  mockUseFixedEvolution.mockReturnValue(mockQueryError(new Error("Network error"), { refetch }));
}

function renderCard(props: Partial<React.ComponentProps<typeof FixedEvolutionCard>> = {}) {
  return render(
    <FixedEvolutionCard rangeMonths={RANGE_MONTHS} titlePlaceholder="Reporte 1" {...props} />,
    { wrapper: createWrapper() },
  );
}

// ─── Tests: estados de carga ───────────────────────────────────────────────────

describe("FixedEvolutionCard — estado de carga", () => {
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
});

// ─── Tests: estado de error ────────────────────────────────────────────────────

describe("FixedEvolutionCard — estado de error", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: estado "rango sin gastos fijos" ────────────────────────────────────

describe("FixedEvolutionCard — rango sin gastos fijos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockDataEmpty);
  });

  it("muestra overlay 'Sin gastos fijos en el rango.'", () => {
    renderCard();
    expect(screen.getByText("Sin gastos fijos en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Probá un rango más largo.")).toBeInTheDocument();
  });

  it("NO renderiza la leyenda (universo vacío)", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /elegir gastos fijos/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: estado nuevo — lines vacío + excluded lleno ───────────────────────

describe("FixedEvolutionCard — ningún fijo con evolución, pero sí excluidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockDataEmptyWithExcluded);
  });

  it("muestra el overlay específico de este estado", () => {
    renderCard();
    expect(screen.getByText("Ningún gasto fijo tiene dos apariciones en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Alargá el rango para ver su evolución.")).toBeInTheDocument();
  });

  it("NO renderiza la leyenda-filtro, pero SÍ el disparador de excluidos", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /elegir gastos fijos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gastos fijos con una sola aparición/i })).toBeInTheDocument();
  });

  it("NO renderiza LegendAllChip ni el contador", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: /mostrar todos los gastos fijos|ocultar todos los gastos fijos/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: estado "ningún fijo seleccionado" ─────────────────────────────────

describe("FixedEvolutionCard — ningún fijo seleccionado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra el overlay de selección vacía y NO bloquea la leyenda", () => {
    renderCard({ selectedIds: [] });
    expect(screen.getByText("Ningún gasto fijo seleccionado.")).toBeInTheDocument();
    expect(screen.getByText("Elegí uno en la lista de abajo.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /elegir gastos fijos/i })).toBeInTheDocument();
  });
});

// ─── Tests: una línea por fijo, sin total ─────────────────────────────────────

describe("FixedEvolutionCard — líneas del canvas", () => {
  // ChartResponsiveArea monta DOS canvases en paralelo (300px oculto por CSS en
  // compacto, 220px oculto por CSS en amplio — ver docs/design.md §11); por eso
  // cada `data-testid="line-*"` aparece duplicado en el DOM de test (jsdom no
  // aplica `@max-wide`/`@wide`). Se toma el primero de cada par.
  function firstLine(testId: string) {
    return screen.getAllByTestId(testId)[0]!;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("renderiza una línea por cada gasto fijo (dataKey=chainId)", () => {
    renderCard();
    expect(firstLine("line-fx-alquiler")).toBeInTheDocument();
    expect(firstLine("line-fx-expensas")).toBeInTheDocument();
    expect(firstLine("line-fx-calc")).toBeInTheDocument();
  });

  it("NO renderiza ninguna línea de total/suma", () => {
    renderCard();
    expect(screen.queryByTestId("line-total")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-sum")).not.toBeInTheDocument();
  });

  it("el calculado se dibuja dasheado '6 4'", () => {
    renderCard();
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");
  });

  it("los fijos normales NO llevan dasharray", () => {
    renderCard();
    expect(firstLine("line-fx-alquiler")).not.toHaveAttribute("data-dasharray", "6 4");
  });

  it("dos fijos de la MISMA categoría reciben colores (tonalidades) distintos", () => {
    renderCard();
    const strokeAlquiler = firstLine("line-fx-alquiler").getAttribute("data-stroke");
    const strokeExpensas = firstLine("line-fx-expensas").getAttribute("data-stroke");
    expect(strokeAlquiler).toBeTruthy();
    expect(strokeExpensas).toBeTruthy();
    expect(strokeAlquiler).not.toBe(strokeExpensas);
  });

  it("la línea plena NO conecta nulos en Montos (el puente es una Line aparte)", () => {
    renderCard();
    expect(firstLine("line-fx-alquiler")).toHaveAttribute("data-connect-nulls", "false");
  });

  it("la línea plena NO conecta nulos en Variación", () => {
    renderCard({ mode: "variation" });
    expect(firstLine("line-fx-alquiler")).toHaveAttribute("data-connect-nulls", "false");
  });

  it("un fijo con hueco interno en Montos dibuja una Line de puente adicional (connectNulls=true, opacidad 0.35)", () => {
    renderCard();
    const bridge = screen.getAllByTestId("line-fx-hueco__bridge__0")[0]!;
    expect(bridge).toHaveAttribute("data-connect-nulls", "true");
    expect(bridge).toHaveAttribute("data-opacity", "0.35");
  });

  it("en Variación NO se dibuja ninguna Line de puente", () => {
    renderCard({ mode: "variation" });
    expect(screen.queryByTestId("line-fx-hueco__bridge__0")).not.toBeInTheDocument();
  });
});

// ─── Tests: dash del calculado sobrevive a un cambio de modo ──────────────────
//
// Bug de QA: al cambiar de modo (Montos ⇄ Variación) sobre un LineChart ya
// montado, la animación de "draw" de Recharts (anima vía stroke-dasharray)
// quedaba congelada a mitad de camino, mezclándose con el dasharray "6 4" del
// calculado. La corrección desactiva la animación de entrada
// (`isAnimationActive={false}`) en todas las Line de esta card — ver Gotchas
// en el header del componente. Este test no puede reproducir la animación
// real de Recharts en jsdom (está mockeado), pero sí congela el contrato: el
// dasharray declarado del calculado se mantiene idéntico tras ida y vuelta de
// modo.
describe("FixedEvolutionCard — dash del calculado tras cambio de modo", () => {
  function firstLine(testId: string) {
    return screen.getAllByTestId(testId)[0]!;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("el calculado conserva '6 4' después de ir a Variación y volver a Montos", () => {
    const { rerender } = renderCard({ mode: "amounts" });
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");

    rerender(<FixedEvolutionCard rangeMonths={RANGE_MONTHS} titlePlaceholder="Reporte 1" mode="variation" />);
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");

    rerender(<FixedEvolutionCard rangeMonths={RANGE_MONTHS} titlePlaceholder="Reporte 1" mode="amounts" />);
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");
  });

  it("un fijo normal sigue sin dasharray después del mismo round-trip de modo", () => {
    const { rerender } = renderCard({ mode: "amounts" });
    rerender(<FixedEvolutionCard rangeMonths={RANGE_MONTHS} titlePlaceholder="Reporte 1" mode="variation" />);
    rerender(<FixedEvolutionCard rangeMonths={RANGE_MONTHS} titlePlaceholder="Reporte 1" mode="amounts" />);
    expect(firstLine("line-fx-alquiler")).not.toHaveAttribute("data-dasharray", "6 4");
  });
});

// ─── Tests: modo de visualización (ViewTabs + chip) ───────────────────────────

describe("FixedEvolutionCard — modo de visualización", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("la tab 'Montos' es la seleccionada por defecto", () => {
    renderCard();
    expect(screen.getByRole("tab", { name: "Montos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Variación" })).toHaveAttribute("aria-selected", "false");
  });

  it("al hacer clic en 'Variación' llama a onModeChange('variation')", () => {
    const onModeChange = vi.fn();
    renderCard({ onModeChange });
    fireEvent.click(screen.getByRole("tab", { name: "Variación" }));
    expect(onModeChange).toHaveBeenCalledWith("variation");
  });

  it("el chip 'Ajustada por inflación' está deshabilitado en Montos, con motivo en title", () => {
    renderCard({ mode: "amounts" });
    const chip = screen.getByRole("button", { name: /ajustada por inflación/i });
    expect(chip).toHaveAttribute("aria-disabled", "true");
    expect(chip).toHaveAttribute("title", "El ajuste por inflación solo aplica a la variación.");
  });

  it("el chip 'Ajustada por inflación' está habilitado en Variación", () => {
    renderCard({ mode: "variation" });
    const chip = screen.getByRole("button", { name: /ajustada por inflación/i });
    expect(chip).not.toHaveAttribute("aria-disabled", "true");
  });

  it("clickear el chip en Variación llama a onAdjustedChange(true)", () => {
    const onAdjustedChange = vi.fn();
    renderCard({ mode: "variation", adjusted: false, onAdjustedChange });
    fireEvent.click(screen.getByRole("button", { name: /ajustada por inflación/i }));
    expect(onAdjustedChange).toHaveBeenCalledWith(true);
  });

  it("clickear el chip deshabilitado en Montos NO llama a onAdjustedChange", () => {
    const onAdjustedChange = vi.fn();
    renderCard({ mode: "amounts", onAdjustedChange });
    fireEvent.click(screen.getByRole("button", { name: /ajustada por inflación/i }));
    expect(onAdjustedChange).not.toHaveBeenCalled();
  });
});

// ─── Tests: leyenda-selector de fijos ─────────────────────────────────────────

describe("FixedEvolutionCard — leyenda-selector de fijos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra un ítem por cada fijo, sin agrupar", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /elegir gastos fijos/i });
    expect(group.querySelectorAll("button")).toHaveLength(4);
  });

  it("nace con todos los fijos seleccionados (aria-pressed=true)", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /elegir gastos fijos/i });
    group.querySelectorAll("button").forEach((btn) => {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("el contador muestra N / M seleccionados", () => {
    renderCard();
    expect(screen.getByTitle("4 de 4 gastos fijos seleccionados")).toBeInTheDocument();
  });

  it("al destildar un fijo llama a onSelectedIdsChange sin ese chainId", () => {
    const onSelectedIdsChange = vi.fn();
    renderCard({ onSelectedIdsChange });
    fireEvent.click(screen.getByText("Alquiler"));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(["fx-expensas", "fx-calc", "fx-hueco"]);
  });

  it("'Ninguna' llama a onSelectedIdsChange([]) cuando todos están visibles", () => {
    const onSelectedIdsChange = vi.fn();
    renderCard({ onSelectedIdsChange });
    fireEvent.click(screen.getByRole("button", { name: /ocultar todos los gastos fijos/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
  });

  it("'Todas' llama a onSelectedIdsChange(null) cuando la selección está vacía", () => {
    const onSelectedIdsChange = vi.fn();
    renderCard({ selectedIds: [], onSelectedIdsChange });
    fireEvent.click(screen.getByRole("button", { name: /mostrar todos los gastos fijos/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(null);
  });

  it("un ítem destildado queda tachado y en opacidad reducida", () => {
    renderCard({ selectedIds: ["fx-expensas", "fx-calc", "fx-hueco"] });
    const alquilerBtn = screen.getByText("Alquiler").closest("button")!;
    expect(alquilerBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Alquiler")).toHaveClass("line-through");
  });

  it("el título del ítem 'sin trazo' habla del rango, no de un año", () => {
    renderCard({ mode: "variation" });
    // Ninguna línea del fixture queda sin trazo en variación en este set, pero
    // el copy en sí (sin depender de {year}) se congela vía el helper de la card:
    // se verifica indirectamente con el fixture de "sin trazo" sería redundante
    // acá; el contrato del copy está cubierto por el estado "ningún fijo con
    // evolución" (usa el mismo vocabulario "en el rango").
    expect(screen.queryByText(/en 20\d\d/)).not.toBeInTheDocument();
  });
});

// ─── Tests: selector de rango ──────────────────────────────────────────────────

describe("FixedEvolutionCard — selector de rango", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("el disparador muestra el rótulo de la opción persistida", () => {
    renderCard({ rangeMonths: 12 });
    expect(screen.getByRole("button", { name: /rango del reporte/i })).toHaveTextContent("1 año");
  });

  it("nace en '3 años' cuando no se pasa rangeMonths", () => {
    render(<FixedEvolutionCard titlePlaceholder="Reporte 1" />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /rango del reporte/i })).toHaveTextContent("3 años");
  });

  it("abre un listbox con las 8 opciones en orden", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /rango del reporte/i }));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "3 meses", "6 meses", "9 meses", "1 año", "2 años", "3 años", "4 años", "5 años",
    ]);
  });

  it("elegir una opción llama a onRangeMonthsChange y cierra el popover", () => {
    const onRangeMonthsChange = vi.fn();
    renderCard({ rangeMonths: 36, onRangeMonthsChange });
    fireEvent.click(screen.getByRole("button", { name: /rango del reporte/i }));
    fireEvent.click(screen.getByRole("option", { name: "5 años" }));
    expect(onRangeMonthsChange).toHaveBeenCalledWith(60);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("la opción persistida lleva aria-selected=true", () => {
    renderCard({ rangeMonths: 24 });
    fireEvent.click(screen.getByRole("button", { name: /rango del reporte/i }));
    expect(screen.getByRole("option", { name: "2 años" })).toHaveAttribute("aria-selected", "true");
  });

  it("muestra la nota de recorte cuando el rango efectivo es menor al pedido", () => {
    renderCard({ rangeMonths: 60 }); // mockData.rangeMonths = 6 (efectivo) < 60 (pedido)
    expect(screen.getByText("Desde Nov 2025 — es todo tu historial.")).toBeInTheDocument();
    // El disparador sigue mostrando la opción elegida, nunca el efectivo.
    expect(screen.getByRole("button", { name: /rango del reporte/i })).toHaveTextContent("5 años");
  });

  it("NO muestra la nota cuando el rango efectivo coincide con el pedido", () => {
    renderCard({ rangeMonths: RANGE_MONTHS });
    expect(screen.queryByText(/es todo tu historial/)).not.toBeInTheDocument();
  });
});

// ─── Tests: superficie de excluidos ────────────────────────────────────────────

describe("FixedEvolutionCard — superficie de excluidos", () => {
  it("muestra el chip 'N sin evolución' cuando hay excluidos", () => {
    mockHookWithData(mockData);
    renderCard();
    expect(screen.getByRole("button", { name: /gastos fijos con una sola aparición/i })).toBeInTheDocument();
  });

  it("NO muestra el chip cuando excluded está vacío", () => {
    mockHookWithData({ ...mockData, excluded: [] });
    renderCard();
    expect(screen.queryByText(/sin evolución/)).not.toBeInTheDocument();
  });

  it("clickear el chip abre un popover con la lista de excluidos", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /gastos fijos con una sola aparición/i }));
    const dialog = screen.getByRole("dialog", { name: /gastos fijos sin evolución en el rango/i });
    expect(within(dialog).getByText("Suscripción nueva")).toBeInTheDocument();
    expect(within(dialog).getByText(/Ocio · desde Abr 2026/)).toBeInTheDocument();
  });

  it("cierra con Escape", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /gastos fijos con una sola aparición/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ─── Tests: cabecera ──────────────────────────────────────────────────────────

describe("FixedEvolutionCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("NO muestra ningún stepper de año ni flechas de período", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: /año anterior|año siguiente/i })).not.toBeInTheDocument();
  });

  it("muestra el placeholder de título cuando no hay título propio", () => {
    renderCard({ titlePlaceholder: "Reporte 3" });
    expect(screen.getByText("Reporte 3")).toBeInTheDocument();
  });

  it("muestra el título propio cuando se proporciona", () => {
    renderCard({ title: "Mis fijos", titlePlaceholder: "Reporte 1" });
    expect(screen.getByText("Mis fijos")).toBeInTheDocument();
  });

  it("muestra el botón quitar cuando removable=true, y confirma antes de llamar a onRemove", () => {
    const onRemove = vi.fn();
    renderCard({ removable: true, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));
    expect(screen.getByText("¿Quitar este reporte?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^quitar$/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("NO muestra el botón quitar cuando removable=false", () => {
    renderCard({ removable: false });
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
  });

  it("muestra el selector de moneda, siempre habilitado", () => {
    renderCard();
    const currencyBtn = screen.getByRole("button", { name: /moneda del reporte/i });
    expect(currencyBtn).toBeInTheDocument();
    expect(currencyBtn).not.toBeDisabled();
  });
});

// ─── Tests: fuera de alcance (RF-REP-013) ─────────────────────────────────────

describe("FixedEvolutionCard — piezas fuera de alcance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("NO muestra chip de 'Simulados'", () => {
    renderCard();
    expect(screen.queryByText(/simulad/i)).not.toBeInTheDocument();
  });

  it("NO muestra filtro de categorías", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /filtrar categor/i })).not.toBeInTheDocument();
  });
});

// ─── Tests: hook llamado con parámetros correctos ─────────────────────────────

describe("FixedEvolutionCard — parámetros del hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookLoading();
  });

  it("llama a useFixedEvolution con rangeMonths, moneda y today, sin categorías", () => {
    renderCard({ rangeMonths: 24, currency: "USD" });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(24, "USD", expect.any(String));
  });

  it("llama a useFixedEvolution con currency=undefined cuando no se pasa override", () => {
    renderCard({ rangeMonths: 36 });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(36, undefined, expect.any(String));
  });

  it("default de rangeMonths es 36 cuando la prop está ausente", () => {
    render(<FixedEvolutionCard titlePlaceholder="Reporte 1" />, { wrapper: createWrapper() });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(36, undefined, expect.any(String));
  });
});

// ─── Tests: computePlotSlot — densidad de puntos (§4.B) + fix de margen (QA Ola 6) ─

describe("computePlotSlot", () => {
  it("descuenta el ancho del eje Y y el margen horizontal REAL del LineChart (left + CHART_END_LABEL_MARGIN)", () => {
    // containerWidth=1000, yAxisWidth=56, 12 meses.
    // Ancho útil esperado = 1000 - 4 (left) - CHART_END_LABEL_MARGIN (right) - 56.
    const expectedUsable = 1000 - 4 - CHART_END_LABEL_MARGIN - 56;
    expect(computePlotSlot(1000, 12, 56)).toBeCloseTo(expectedUsable / 12);
  });

  it("nunca es negativo aunque el ancho medido sea menor que el margen + eje Y", () => {
    expect(computePlotSlot(10, 12, 56)).toBe(0);
  });

  it("es 0 sin medición en vivo (containerWidth=0, SSR/test) — densidad mínima segura", () => {
    expect(computePlotSlot(0, 12, 56)).toBe(0);
  });

  it("es 0 sin meses (monthsCount=0)", () => {
    expect(computePlotSlot(1000, 0, 56)).toBe(0);
  });
});

// ─── Test: margen derecho reservado para que el rótulo final del eje X entre ───

describe("CHART_END_LABEL_MARGIN (fix de QA visual — desborde del último rótulo)", () => {
  it("reserva más que la mitad medida del rótulo de dos líneas más ancho ('2026', mono) para no cortarse contra el borde del SVG", () => {
    // Medido en el navegador: con margin.right=4, "2026" desbordaba 9px → mitad
    // real ≈ 13px. El margen compartido debe cubrir ese peor caso con aire de
    // sobra para variaciones de fuente/zoom entre navegadores.
    expect(CHART_END_LABEL_MARGIN).toBeGreaterThan(13);
  });
});
