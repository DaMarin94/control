/**
 * Tests de FixedEvolutionCard (Ola 5, P6 — "Detalle histórico de gastos fijos", RF-REP-013).
 *
 * Verifica:
 * - Estados de carga / error / año sin gastos fijos / ningún fijo seleccionado
 * - Una línea por gasto fijo (dataKey=chainId), sin línea total
 * - Clave de color: dos fijos de la misma categoría reciben tonalidades distintas
 * - Calculado: dasheado "6 4"
 * - `connectNulls` true en Montos, false en Variación
 * - Modo de visualización (ViewTabs Montos/Variación) y chip "Ajustada por inflación"
 *   (deshabilitado con motivo en Montos, habilitado en Variación)
 * - Leyenda-selector: toggle individual y "Todas"/"Ninguna", contador N/M
 * - Cabecera: título editable, YearStepper con topes propios, selector de moneda, botón quitar
 * - Ausencia de piezas fuera de alcance: sin chip de Simulados, sin filtro de categorías
 * - Hook useFixedEvolution llamado con los parámetros correctos (sin `categories`)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnnualFijosResponse, FixedEvolutionLine, FixedEvolutionMonthPoint } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useFixedEvolution: vi.fn(),
  FIXED_EVOLUTION_QUERY_KEY: (year: number, currency: string | null, today: string | null) => [
    "reports-fixed-evolution",
    year,
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
import { FixedEvolutionCard } from "@/components/charts/fixed-evolution-card";
import { mockQuerySuccess, mockQueryLoading, mockQueryError } from "../../utils/query-result";

const mockUseFixedEvolution = vi.mocked(useFixedEvolution);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

/** 12 meses con monto fijo (todos con dato, reason null). */
function buildFullMonths(amountCents: number): FixedEvolutionMonthPoint[] {
  return Array.from({ length: 12 }, () => ({
    amountCents,
    nominalPct: null,
    adjustedPct: null,
    reason: null,
  }));
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

const mockData: AnnualFijosResponse = {
  year: 2026,
  currency: "ARS",
  lines: [lineAlquiler, lineExpensas, lineCalculado],
  earliestYear: 2022,
  latestYear: 2027,
};

const mockDataEmpty: AnnualFijosResponse = {
  ...mockData,
  lines: [],
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
    <FixedEvolutionCard year={2026} titlePlaceholder="Reporte 1" {...props} />,
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

// ─── Tests: estado "año sin gastos fijos" ─────────────────────────────────────

describe("FixedEvolutionCard — año sin gastos fijos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockDataEmpty);
  });

  it("muestra overlay 'Sin gastos fijos en {año}.'", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("Sin gastos fijos en 2026.")).toBeInTheDocument();
  });

  it("NO renderiza la leyenda (universo vacío)", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: /elegir gastos fijos/i })).not.toBeInTheDocument();
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

  it("connectNulls=true en modo Montos (default)", () => {
    renderCard();
    expect(firstLine("line-fx-alquiler")).toHaveAttribute("data-connect-nulls", "true");
  });

  it("connectNulls=false en modo Variación", () => {
    renderCard({ mode: "variation" });
    expect(firstLine("line-fx-alquiler")).toHaveAttribute("data-connect-nulls", "false");
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

    rerender(<FixedEvolutionCard year={2026} titlePlaceholder="Reporte 1" mode="variation" />);
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");

    rerender(<FixedEvolutionCard year={2026} titlePlaceholder="Reporte 1" mode="amounts" />);
    expect(firstLine("line-fx-calc")).toHaveAttribute("data-dasharray", "6 4");
  });

  it("un fijo normal sigue sin dasharray después del mismo round-trip de modo", () => {
    const { rerender } = renderCard({ mode: "amounts" });
    rerender(<FixedEvolutionCard year={2026} titlePlaceholder="Reporte 1" mode="variation" />);
    rerender(<FixedEvolutionCard year={2026} titlePlaceholder="Reporte 1" mode="amounts" />);
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
    expect(group.querySelectorAll("button")).toHaveLength(3);
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
    expect(screen.getByTitle("3 de 3 gastos fijos seleccionados")).toBeInTheDocument();
  });

  it("al destildar un fijo llama a onSelectedIdsChange sin ese chainId", () => {
    const onSelectedIdsChange = vi.fn();
    renderCard({ onSelectedIdsChange });
    fireEvent.click(screen.getByText("Alquiler"));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(["fx-expensas", "fx-calc"]);
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
    renderCard({ selectedIds: ["fx-expensas", "fx-calc"] });
    const alquilerBtn = screen.getByText("Alquiler").closest("button")!;
    expect(alquilerBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Alquiler")).toHaveClass("line-through");
  });
});

// ─── Tests: cabecera ──────────────────────────────────────────────────────────

describe("FixedEvolutionCard — cabecera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookWithData(mockData);
  });

  it("muestra el stepper de año con el año pedido", () => {
    renderCard({ year: 2026 });
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("el botón ‹ está deshabilitado cuando year === earliestYear (propio de la card)", () => {
    renderCard({ year: 2022 }); // earliestYear=2022 en mockData
    expect(screen.getByRole("button", { name: /año anterior/i })).toBeDisabled();
  });

  it("el botón › está deshabilitado cuando year === latestYear (propio de la card)", () => {
    renderCard({ year: 2027 }); // latestYear=2027 en mockData
    expect(screen.getByRole("button", { name: /año siguiente/i })).toBeDisabled();
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

  it("llama a useFixedEvolution con año, moneda y today, sin categorías", () => {
    renderCard({ year: 2025, currency: "USD" });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(2025, "USD", expect.any(String));
  });

  it("llama a useFixedEvolution con currency=undefined cuando no se pasa override", () => {
    renderCard({ year: 2026 });
    expect(mockUseFixedEvolution).toHaveBeenCalledWith(2026, undefined, expect.any(String));
  });
});
