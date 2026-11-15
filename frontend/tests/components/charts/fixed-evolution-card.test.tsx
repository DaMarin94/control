/**
 * Tests de FixedEvolutionCard ("Detalle histórico de fijos", RF-REP-013,
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
import type { FijosHistoricoResponse, FixedEvolutionLine, FixedEvolutionMonthPoint, FixedEvolutionExcludedLine } from "@/types/reports";

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
import { FixedEvolutionCard, CustomTooltip, PointMarker, computePlotSlot, getGapMotive } from "@/components/charts/fixed-evolution-card";
import { FX_PALETTE, anchorFixedEvolutionColor } from "@/lib/fixed-evolution-colors";
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
  type: "EXPENSE",
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
  type: "EXPENSE",
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
  type: "EXPENSE",
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
  type: "EXPENSE",
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
  type: "EXPENSE",
  isCalculated: false,
  description: "Suscripción nueva",
  categoryId: "cat-ocio",
  categoryName: "Ocio",
  categoryColor: "#4F86C6",
  startMonth: "2026-04",
};

const mockData: FijosHistoricoResponse = {
  currency: "ARS",
  rangeMonths: RANGE_MONTHS,
  startMonth: "2025-11",
  endMonth: "2026-04",
  lines: [lineAlquiler, lineExpensas, lineCalculado, lineHueco],
  excluded: [excludedItem],
};

const mockDataEmpty: FijosHistoricoResponse = {
  ...mockData,
  lines: [],
  excluded: [],
};

const mockDataEmptyWithExcluded: FijosHistoricoResponse = {
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

function mockHookWithData(data: FijosHistoricoResponse) {
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

  it("muestra overlay 'Sin fijos en el rango.'", () => {
    renderCard();
    expect(screen.getByText("Sin fijos en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Probá un rango más largo.")).toBeInTheDocument();
  });

  it("NO renderiza la leyenda (universo vacío)", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /elegir fijos/i })).not.toBeInTheDocument();
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
    expect(screen.getByText("Ningún fijo tiene dos apariciones en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Alargá el rango para ver su evolución.")).toBeInTheDocument();
  });

  it("NO renderiza la leyenda-filtro, pero SÍ el disparador de excluidos", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /elegir fijos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fijos con una sola aparición/i })).toBeInTheDocument();
  });

  it("NO renderiza LegendAllChip ni el contador", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: /mostrar todos los fijos|ocultar todos los fijos/i })).not.toBeInTheDocument();
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
    expect(screen.getByText("Ningún fijo seleccionado.")).toBeInTheDocument();
    expect(screen.getByText("Elegí uno en la lista de abajo.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /elegir fijos/i })).toBeInTheDocument();
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

  it("el color de cada línea es FX[ordinal mod 12], sin depender de la categoría", () => {
    renderCard();
    // alquiler ordinal 1, expensas ordinal 2 (misma categoría): colores FX distintos.
    expect(firstLine("line-fx-alquiler").getAttribute("data-stroke")).toBe(FX_PALETTE[1]);
    expect(firstLine("line-fx-expensas").getAttribute("data-stroke")).toBe(FX_PALETTE[2]);
    expect(firstLine("line-fx-calc").getAttribute("data-stroke")).toBe(FX_PALETTE[3]);
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

// ─── Tests: copys de motivo de hueco en variación (docs/design.md §4) ─────────
//
// La variación se compara contra el PAGO ANTERIOR de la línea (nunca "el mes
// anterior"), y el ajuste por inflación es un estado PARCIAL: se distingue
// `nominalPct: null` (sin pago anterior — no hay nada que comparar, ni
// siquiera nominal) de `nominalPct` con valor + `adjustedPct: null` (el mes
// SÍ dibuja en Variación nominal; solo se cae el ajuste por falta de IPC).

describe("FixedEvolutionCard — getGapMotive (copys de variación)", () => {
  it("Variación nominal sin pago anterior: no nombra 'mes anterior'", () => {
    const point = buildPoint("2026-02", 10000, null);
    expect(getGapMotive(point, "nominal", lineAlquiler)).toBe(
      "Sin variación computable — no hay un pago anterior con el que comparar.",
    );
  });

  it("Ajustada sin pago anterior (nominalPct null): mismo copy que la nominal", () => {
    const point = { ...buildPoint("2026-02", 10000, null), nominalPct: null };
    expect(getGapMotive(point, "adjusted", lineAlquiler)).toBe(
      "Sin variación computable — no hay un pago anterior con el que comparar.",
    );
  });

  it("Ajustada CON pago anterior pero sin dato de inflación (adjustedPct null): copy de ajuste, sin nombrar ningún mes", () => {
    const point = { ...buildPoint("2026-02", 10000, null), nominalPct: 8.3, adjustedPct: null };
    const motive = getGapMotive(point, "adjusted", lineAlquiler);
    expect(motive).toBe("Sin ajuste por inflación — falta el dato de algún mes desde el pago anterior.");
    expect(motive).not.toMatch(/\d{4}/); // sin año/mes concreto: el contrato no lo identifica
  });
});

// ─── Tests: overlay "Variación sin nada computable" — dos variantes (§10) ─────
//
// `mockData` fija `nominalPct`/`adjustedPct` en null para todos los meses de
// todas las líneas, así que en Variación el estado "nada computable" se
// dispara con los fixtures de siempre: sirve para cubrir el copy exacto y las
// DOS variantes según el chip de ajuste, sin fixtures nuevos.

describe("FixedEvolutionCard — overlay 'Variación sin nada computable'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("chip de ajuste APAGADO: 'Sin variación computable en el rango.' + 'Faltan datos para comparar cada pago con el anterior.'", () => {
    renderCard({ mode: "variation", adjusted: false });
    expect(screen.getByText("Sin variación computable en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Faltan datos para comparar cada pago con el anterior.")).toBeInTheDocument();
  });

  it("chip de ajuste ENCENDIDO: 'Sin variación ajustada en el rango.' + 'Probá sin el ajuste por inflación.'", () => {
    renderCard({ mode: "variation", adjusted: true });
    expect(screen.getByText("Sin variación ajustada en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Probá sin el ajuste por inflación.")).toBeInTheDocument();
  });

  it("en Montos (modo 'amounts') el overlay de variación NO aparece", () => {
    renderCard({ mode: "amounts" });
    expect(screen.queryByText("Sin variación computable en el rango.")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin variación ajustada en el rango.")).not.toBeInTheDocument();
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
    const group = screen.getByRole("group", { name: /elegir fijos/i });
    expect(group.querySelectorAll("button")).toHaveLength(4);
  });

  it("nace con todos los fijos seleccionados (aria-pressed=true)", () => {
    renderCard();
    const group = screen.getByRole("group", { name: /elegir fijos/i });
    group.querySelectorAll("button").forEach((btn) => {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("el contador muestra N / M seleccionados", () => {
    renderCard();
    expect(screen.getByTitle("4 de 4 fijos seleccionados")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /ocultar todos los fijos/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
  });

  it("'Todas' llama a onSelectedIdsChange(null) cuando la selección está vacía", () => {
    const onSelectedIdsChange = vi.fn();
    renderCard({ selectedIds: [], onSelectedIdsChange });
    fireEvent.click(screen.getByRole("button", { name: /mostrar todos los fijos/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(null);
  });

  it("un ítem destildado queda tachado y en opacidad reducida", () => {
    renderCard({ selectedIds: ["fx-expensas", "fx-calc", "fx-hueco"] });
    const alquilerBtn = screen.getByText("Alquiler").closest("button")!;
    expect(alquilerBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Alquiler")).toHaveClass("line-through");
  });

  // `mockData` fija `nominalPct` en null para todos los meses de todas las
  // líneas, así que en Variación TODAS quedan "sin trazo en el modo actual" —
  // útil para congelar las dos variantes del `title` según el chip de ajuste
  // (docs/design.md §8), sin nombrar nunca un año.
  it("ítem 'sin trazo' con el chip de ajuste APAGADO: title habla de 'ningún pago... con el anterior'", () => {
    renderCard({ mode: "variation", adjusted: false });
    const alquilerBtn = screen.getByText("Alquiler").closest("button")!;
    expect(alquilerBtn).toHaveAttribute(
      "title",
      "Sin variación computable en el rango — ningún pago de este fijo se pudo comparar con el anterior.",
    );
  });

  it("ítem 'sin trazo' con el chip de ajuste ENCENDIDO: title distinto, sin nombrar ningún año", () => {
    renderCard({ mode: "variation", adjusted: true });
    const alquilerBtn = screen.getByText("Alquiler").closest("button")!;
    expect(alquilerBtn).toHaveAttribute(
      "title",
      "Sin variación ajustada en el rango — falta el dato de inflación entre sus pagos.",
    );
    expect(alquilerBtn.title).not.toMatch(/en 20\d\d/);
  });

  it("un fijo 'sin trazo' NO queda tachado (se distingue del destildado)", () => {
    renderCard({ mode: "variation", adjusted: false });
    expect(screen.getByText("Alquiler")).not.toHaveClass("line-through");
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

  it("el listbox se alinea al borde derecho del disparador cuando no entra a la izquierda", () => {
    const prevW = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 });
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isPanel = this.getAttribute("role") === "listbox";
      const r = isPanel
        ? { left: 0, right: 132, width: 132, top: 0, bottom: 100, height: 100 }
        : { left: 540, right: 600, width: 60, top: 10, bottom: 40, height: 30 };
      return { ...r, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      renderCard();
      fireEvent.click(screen.getByRole("button", { name: /rango del reporte/i }));
      const left = parseFloat(screen.getByRole("listbox").style.left);
      expect(left + 132).toBeLessThanOrEqual(600 - 12);
      expect(left).toBeGreaterThanOrEqual(12);
    } finally {
      spy.mockRestore();
      Object.defineProperty(window, "innerWidth", { configurable: true, value: prevW });
    }
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
    expect(screen.getByRole("button", { name: /fijos con una sola aparición/i })).toBeInTheDocument();
  });

  it("NO muestra el chip cuando excluded está vacío", () => {
    mockHookWithData({ ...mockData, excluded: [] });
    renderCard();
    expect(screen.queryByText(/sin evolución/)).not.toBeInTheDocument();
  });

  it("clickear el chip abre un popover con la lista de excluidos", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /fijos con una sola aparición/i }));
    const dialog = screen.getByRole("dialog", { name: /fijos sin evolución en el rango/i });
    expect(within(dialog).getByText("Suscripción nueva")).toBeInTheDocument();
    expect(within(dialog).getByText(/Ocio · desde Abr 2026/)).toBeInTheDocument();
  });

  it("el ítem excluido no lleva swatch/mini-línea y su sublínea lleva el punto de categoría", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /fijos con una sola aparición/i }));
    const dialog = screen.getByRole("dialog", { name: /fijos sin evolución en el rango/i });
    const item = within(dialog).getByRole("listitem");
    expect(item.querySelector("svg")).toBeNull();
    const dots = Array.from(item.querySelectorAll("span")).filter((el) => el.className.includes("rounded-full"));
    expect(dots).toHaveLength(1);
    expect((dots[0] as HTMLElement).style.background).toMatch(/rgb\(79, 134, 198\)|#4f86c6/i);
  });

  it("el ítem excluido apila en dos líneas: descripción arriba, sublínea con punto debajo", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /fijos con una sola aparición/i }));
    const item = within(screen.getByRole("dialog", { name: /fijos sin evolución en el rango/i })).getByRole("listitem");
    const desc = within(item).getByText("Suscripción nueva").closest("p") as HTMLElement;
    const sub = within(item).getByTestId("excluded-subline");
    expect(desc).not.toBe(sub);
    expect(desc.parentElement).toBe(sub.parentElement);
    expect(desc.nextElementSibling).toBe(sub);
    // Ambas son de bloque (flex), nunca inline-flex: no comparten línea.
    expect(desc.className).not.toMatch(/inline/);
    expect(sub.className).not.toMatch(/inline/);
    expect(sub.className).toContain("gap-1.25");
    expect(sub.firstElementChild?.className).toContain("rounded-full");
    expect(sub.textContent).toMatch(/Ocio · desde Abr 2026/);
    expect(desc.textContent).not.toMatch(/Ocio/);
  });

  it("un excluido calculado/de ingreso conserva solo los glifos ↳ / ↑", () => {
    mockHookWithData({
      ...mockData,
      excluded: [{ ...excludedItem, isCalculated: true, type: "INCOME" }],
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /fijos con una sola aparición/i }));
    const item = within(screen.getByRole("dialog", { name: /fijos sin evolución en el rango/i })).getByRole("listitem");
    expect(item.querySelectorAll("svg").length).toBe(2);
    expect(within(item).getByRole("img", { name: "Ingreso" })).toBeInTheDocument();
  });

  it("cierra con Escape", () => {
    mockHookWithData(mockData);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /fijos con una sola aparición/i }));
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
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(24, "USD", expect.any(String), undefined);
  });

  it("llama a useFixedEvolution con currency=undefined cuando no se pasa override", () => {
    renderCard({ rangeMonths: 36 });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(36, undefined, expect.any(String), undefined);
  });

  it("default de rangeMonths es 36 cuando la prop está ausente", () => {
    render(<FixedEvolutionCard titlePlaceholder="Reporte 1" />, { wrapper: createWrapper() });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(36, undefined, expect.any(String), undefined);
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

// ─── Tests: dirección (§3.1) — forma del punto, glifo y color por tipo ────────

describe("PointMarker — forma por dirección", () => {
  it("gasto = círculo de radio r", () => {
    const { container } = render(
      <svg>
        <PointMarker cx={10} cy={10} r={3} fill="red" ring={1.5} income={false} />
      </svg>,
    );
    const circle = container.querySelector("[data-point-shape='circle']");
    expect(circle).not.toBeNull();
    expect(circle).toHaveAttribute("r", "3");
    expect(container.querySelector("[data-point-shape='square']")).toBeNull();
  });

  it("ingreso = cuadrado de lado 2r, esquinas rectas (sin rx), centrado en el punto", () => {
    const { container } = render(
      <svg>
        <PointMarker cx={10} cy={10} r={3} fill="red" ring={1.5} income />
      </svg>,
    );
    const rect = container.querySelector("[data-point-shape='square']");
    expect(rect).not.toBeNull();
    expect(rect).toHaveAttribute("width", "6");
    expect(rect).toHaveAttribute("height", "6");
    expect(rect).toHaveAttribute("x", "7");
    expect(rect).toHaveAttribute("y", "7");
    expect(rect).not.toHaveAttribute("rx");
    expect(container.querySelector("[data-point-shape='circle']")).toBeNull();
  });

  it("sin anillo no dibuja borde", () => {
    const { container } = render(
      <svg>
        <PointMarker cx={0} cy={0} r={2} fill="red" ring={0} income />
      </svg>,
    );
    expect(container.querySelector("rect")).toHaveAttribute("stroke", "none");
  });
});

describe("FixedEvolutionCard — fijos de ingreso en la leyenda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("el ítem de un ingreso lleva el glifo 'Ingreso'; el de un gasto no", () => {
    const sueldo: FixedEvolutionLine = { ...lineAlquiler, chainId: "fx-sueldo", ordinal: 9, description: "Sueldo", type: "INCOME" };
    mockHookWithData({ ...mockData, lines: [sueldo, lineAlquiler] });
    renderCard();
    const group = screen.getByRole("group", { name: /elegir fijos/i });
    const sueldoBtn = within(group).getByRole("button", { name: /sueldo/i });
    const alquilerBtn = within(group).getByRole("button", { name: /alquiler/i });
    expect(within(sueldoBtn).getByRole("img", { name: "Ingreso" })).toBeInTheDocument();
    expect(within(alquilerBtn).queryByRole("img", { name: "Ingreso" })).not.toBeInTheDocument();
  });
});

describe("CustomTooltip — variante acotada y color por tipo", () => {
  const months = ["2026-03", "2026-04"];
  function renderTooltip(type: "EXPENSE" | "INCOME", scoped: boolean, point: FixedEvolutionMonthPoint, value: number | null) {
    const meta = {
      chainId: "c1", color: "red", isCalculated: false, type,
      description: "Sueldo", categoryName: "Trabajo", categoryColor: "#4F86C6", originDescription: null, frequency: 1,
    };
    const line: FixedEvolutionLine = { ...lineAlquiler, chainId: "c1", type, frequency: 2 };
    return render(
      <CustomTooltip
        active
        label="2026-04"
        scoped={scoped}
        mode="amounts"
        currency="ARS"
        highlightedId="c1"
        visibleMeta={[meta]}
        valuesByChain={new Map([["c1", [null, value]]])}
        pointsByChain={new Map([["c1", [null, point]]])}
        lineByChain={new Map([["c1", line]])}
        monthsList={months}
      />,
    );
  }

  it("modo línea: la sublínea lleva el punto de categoría (6px, category.color tal cual)", () => {
    const { container } = renderTooltip("EXPENSE", false, buildPoint("2026-04", 150000), 150000);
    const dot = Array.from(container.querySelectorAll("span")).find((el) => el.className.includes("rounded-full")) as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.className).toContain("w-1.5");
    expect(dot.style.background).toMatch(/rgb\(79, 134, 198\)|#4f86c6/i);
  });

  it("acotada: solo mes + cifra (sin descripción, categoría ni Frecuencia)", () => {
    renderTooltip("EXPENSE", true, buildPoint("2026-04", 150000), 150000);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.queryByText("Sueldo")).not.toBeInTheDocument();
    expect(screen.queryByText("Trabajo")).not.toBeInTheDocument();
    expect(screen.queryByText("Frecuencia")).not.toBeInTheDocument();
  });

  it("acotada: la cifra de un ingreso va en --income-ink y la de un gasto en --ink", () => {
    const { unmount } = renderTooltip("INCOME", true, buildPoint("2026-04", 150000), 150000);
    expect(screen.getByText(/1\.500/).className).toContain("text-income-ink");
    unmount();
    renderTooltip("EXPENSE", true, buildPoint("2026-04", 150000), 150000);
    expect(screen.getByText(/1\.500/).className).toContain("text-ink");
    expect(screen.getByText(/1\.500/).className).not.toContain("income");
  });

  it("acotada: mes sin punto muestra '—' + el motivo", () => {
    renderTooltip("EXPENSE", true, buildPoint("2026-04", null, "skipped"), null);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Mes anulado.")).toBeInTheDocument();
  });

  it("no acotada (modo línea): muestra el badge de dirección Ingreso/Gasto y la fila Frecuencia", () => {
    const { unmount } = renderTooltip("INCOME", false, buildPoint("2026-04", 150000), 150000);
    expect(screen.getByText("Ingreso")).toBeInTheDocument();
    expect(screen.getByText("Frecuencia")).toBeInTheDocument();
    unmount();
    renderTooltip("EXPENSE", false, buildPoint("2026-04", 150000), 150000);
    expect(screen.getByText("Gasto")).toBeInTheDocument();
  });
});

// ─── Tests: variante acotada a un fijo (RF-VM-009, §15) ───────────────────────

describe("FixedEvolutionCard — variante acotada (chainId)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData({ ...mockData, lines: [lineAlquiler], excluded: [] });
  });

  it("llama al hook con el chainId, sin moneda (default)", () => {
    renderCard({ chainId: "fx-alquiler", currency: "USD" });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(RANGE_MONTHS, undefined, expect.any(String), "fx-alquiler");
  });

  it("solo conserva el select de rango: sin tabs, chip, moneda, refrescar, quitar, leyenda, título ni excluidos", () => {
    renderCard({ chainId: "fx-alquiler", removable: true, title: "Mi reporte" });
    expect(screen.getByRole("button", { name: /rango del reporte/i })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ajustada por inflación/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /moneda del reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /actualizar reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /quitar reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /elegir fijos/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Mi reporte")).not.toBeInTheDocument();
    expect(screen.queryByText(/sin evolución/i)).not.toBeInTheDocument();
  });

  it("no tiene envase de card (sin borde ni sombra de panel)", () => {
    const { container } = renderCard({ chainId: "fx-alquiler" });
    expect((container.firstChild as HTMLElement).className).not.toContain("rounded-card");
  });

  it("dibuja una sola línea", () => {
    renderCard({ chainId: "fx-alquiler" });
    expect(screen.getByTestId("line-fx-alquiler")).toBeInTheDocument();
  });

  it("la única línea usa el color de su categoría re-anclado (no la paleta FX)", () => {
    renderCard({ chainId: "fx-alquiler" });
    const stroke = screen.getByTestId("line-fx-alquiler").getAttribute("data-stroke");
    expect(stroke).toBe(anchorFixedEvolutionColor(lineAlquiler.categoryColor));
    expect(FX_PALETTE).not.toContain(stroke);
  });

  it("la única línea va en tratamiento de destacado permanente (2.5px)", () => {
    renderCard({ chainId: "fx-alquiler" });
    expect(screen.getByTestId("line-fx-alquiler")).toHaveAttribute("data-stroke-width", "2.5");
  });

  it("el select cambia el rango vía onRangeMonthsChange", () => {
    const onRangeMonthsChange = vi.fn();
    renderCard({ chainId: "fx-alquiler", onRangeMonthsChange });
    fireEvent.click(screen.getByRole("button", { name: /rango del reporte/i }));
    fireEvent.click(screen.getByRole("option", { name: /2 años/i }));
    expect(onRangeMonthsChange).toHaveBeenCalledWith(24);
  });

  it("cargando: skeleton sin chips, con el select operable", () => {
    mockHookLoading();
    renderCard({ chainId: "fx-alquiler" });
    expect(screen.getByRole("status", { name: /cargando evolución/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rango del reporte/i })).toBeEnabled();
  });

  it("cambio de rango en curso (placeholder data): vuelve a mostrar el skeleton", () => {
    mockUseFixedEvolution.mockReturnValue(mockQuerySuccess(mockData, { isPlaceholderData: true }));
    renderCard({ chainId: "fx-alquiler" });
    expect(screen.getByRole("status", { name: /cargando evolución/i })).toBeInTheDocument();
  });

  it("error: copy propio y Reintentar", () => {
    const refetch = vi.fn();
    mockHookError(refetch);
    renderCard({ chainId: "fx-alquiler" });
    expect(screen.getByText("No se pudo cargar la evolución.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("vacío: copy en singular + segunda línea; con 5 años no ofrece alargar el rango", () => {
    mockHookWithData({ ...mockData, lines: [], excluded: [excludedItem] });
    const { unmount } = renderCard({ chainId: "fx-nuevo", rangeMonths: 12 });
    expect(screen.getByText("Este fijo no tiene dos meses con monto en el rango.")).toBeInTheDocument();
    expect(screen.getByText("Alargá el rango para ver su evolución.")).toBeInTheDocument();
    unmount();
    renderCard({ chainId: "fx-nuevo", rangeMonths: 60 });
    expect(screen.getByText("Este fijo no tiene dos meses con monto en el rango.")).toBeInTheDocument();
    expect(screen.queryByText("Alargá el rango para ver su evolución.")).not.toBeInTheDocument();
  });
});
