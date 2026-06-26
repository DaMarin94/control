/**
 * Tests de la pantalla /reportes (Fase 1.1.5, RF-REP-003/004).
 * Ola 2, P1: modo orden de cards (reordenables con dnd-kit).
 *
 * Verifica:
 * - Estado vacío inicial: H1 "Reportes", eyebrow, recuadro "[+]" grande
 * - Al hacer clic en "[+]" se abre el menú de tipo (Ingresos y gastos / Por categoría)
 * - Al elegir un tipo se agrega una card y se llama a setPreferences
 * - Con cards: cards renderizadas + "[+]" compacto al final
 * - Quitar card llama a setPreferences con el array sin esa card
 * - Modo orden: toggle "Ordenar reportes" / "Listo" (P1)
 * - Modo orden: solo visible con 2+ cards (P1)
 * - Modo orden: mini-ítems en lugar de cards completas (P1)
 * - Modo orden: grips de arrastre visibles (P1)
 * - Modo orden: "[+]" compacto atenuado (P1)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ReportCardConfig } from "@/types/reports";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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


vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

vi.mock("@/hooks/use-reports", () => ({
  useReports: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    isError: false,
    isPending: true,
    isSuccess: false,
    error: null,
    status: "loading",
    fetchStatus: "fetching",
    refetch: vi.fn(),
  })),
  useUnicoGrid: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    isError: false,
    isPending: true,
    isSuccess: false,
    error: null,
    status: "loading",
    fetchStatus: "fetching",
    refetch: vi.fn(),
  })),
  useCuotasGantt: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    isError: false,
    isPending: true,
    isSuccess: false,
    error: null,
    status: "loading",
    fetchStatus: "fetching",
    refetch: vi.fn(),
  })),
  useInflationIncome: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    isError: false,
    isPending: true,
    isSuccess: false,
    error: null,
    status: "loading",
    fetchStatus: "fetching",
    refetch: vi.fn(),
  })),
  REPORTS_QUERY_KEY: (year: number, key: string | null) => ["reports", year, key],
  UNICO_GRID_QUERY_KEY: (year: number, key: string | null) => ["reports-unico-grid", year, key],
  CUOTAS_GANTT_QUERY_KEY: (year: number, key: string | null) => ["reports-cuotas-gantt", year, key],
  INFLATION_INCOME_QUERY_KEY: (year: number, key: string | null) => ["reports-inflation-income", year, key],
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [],
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
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) =>
    React.createElement("div", { "data-testid": "responsive-container" }, children);

  return {
    AreaChart: MockChart,
    BarChart: MockChart,
    LineChart: MockChart,
    Area: () => null,
    Bar: () => null,
    Line: () => null,
    ReferenceLine: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: MockResponsiveContainer,
    Cell: () => null,
  };
});

vi.mock("@/lib/format", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...original,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

// Mock determinista para crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

import { usePreferences } from "@/hooks/use-preferences";
import ReportesPage from "@/app/(app)/reportes/page";

const mockUsePreferences = vi.mocked(usePreferences);

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

function makePreferencesHook(cards: ReportCardConfig[] = [], setPreferences = vi.fn().mockResolvedValue({ success: true })) {
  const preferences: UserPreferences = { reports: cards };
  mockUsePreferences.mockReturnValue({
    preferences,
    setPreferences,
    isLoading: false,
    isError: false,
    error: null,
    isSaving: false,
  });
  return { preferences, setPreferences };
}

function renderPage() {
  return render(<ReportesPage />, { wrapper: createWrapper() });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportesPage — estado vacío inicial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    makePreferencesHook([]);
  });

  it("muestra H1 'Reportes'", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /reportes/i })).toBeInTheDocument();
  });

  it("muestra eyebrow 'Tu actividad'", () => {
    renderPage();
    expect(screen.getByText("Tu actividad")).toBeInTheDocument();
  });

  it("muestra el recuadro '[+]' grande con 'Armá tu primer reporte'", () => {
    renderPage();
    expect(screen.getByText("Armá tu primer reporte")).toBeInTheDocument();
  });

  it("muestra el botón '[+]' accesible", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /agregar primer reporte/i })
    ).toBeInTheDocument();
  });

  it("NO muestra cards de reporte", () => {
    renderPage();
    expect(screen.queryByText("Reporte")).not.toBeInTheDocument();
  });
});

describe("ReportesPage — agregar card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("al hacer clic en '[+]' muestra el menú de tipo con los nuevos labels", () => {
    makePreferencesHook([]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    expect(screen.getByText("Ingresos vs Gastos")).toBeInTheDocument();
    expect(screen.getByText("Gastos por categoría")).toBeInTheDocument();
    expect(screen.getByText("Gastos Únicos")).toBeInTheDocument();
    expect(screen.getByText("Gastos en Cuotas")).toBeInTheDocument();
  });

  it("al elegir 'Ingresos vs Gastos' llama a setPreferences con una card income-expense", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    // Abrir menú
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    // Elegir tipo
    fireEvent.click(screen.getAllByText("Ingresos vs Gastos")[0]!);

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(Array.isArray(callArg.reports)).toBe(true);
    expect(callArg.reports).toHaveLength(1);
    expect(callArg.reports?.[0]?.type).toBe("income-expense");
    expect(callArg.reports?.[0]?.year).toBe(2026);
    expect(callArg.reports?.[0]?.categoryIds).toBeNull();
  });

  it("al elegir 'Gastos por categoría' llama a setPreferences con una card by-category", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    fireEvent.click(screen.getAllByText("Gastos por categoría")[0]!);

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(callArg.reports?.[0]?.type).toBe("by-category");
  });
});

describe("ReportesPage — estado con cards", () => {
  const existingCards: ReportCardConfig[] = [
    { id: "card-1", type: "income-expense", year: 2026, categoryIds: null },
    { id: "card-2", type: "by-category", year: 2025, categoryIds: ["cat-1"] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    makePreferencesHook(existingCards);
  });

  it("NO muestra 'Armá tu primer reporte' cuando ya hay cards", () => {
    renderPage();
    expect(screen.queryByText("Armá tu primer reporte")).not.toBeInTheDocument();
  });

  it("muestra el '[+]' compacto 'Agregar reporte' cuando ya hay cards", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /agregar reporte/i })).toBeInTheDocument();
  });

  it("las cards muestran sus placeholders de título", () => {
    renderPage();
    // Spec actualizado: income-expense es Total-only (sin tablist de vista);
    // by-category tiene tablist "Representación del reporte" con tabs Barra/Línea.
    // Las dos cards sin título propio muestran sus placeholders "Reporte 1" / "Reporte 2".
    expect(screen.getByText("Reporte 1")).toBeInTheDocument();
    expect(screen.getByText("Reporte 2")).toBeInTheDocument();
    // No aparece el texto aislado "Reporte" como eyebrow (ya no existe).
    // income-expense no tiene tablist; by-category tiene "Representación del reporte".
    expect(screen.queryByRole("tablist", { name: /vista del reporte/i })).not.toBeInTheDocument();
    // by-category SÍ tiene el tablist de Barra/Línea.
    expect(screen.getByRole("tablist", { name: /representación del reporte/i })).toBeInTheDocument();
  });

  it("la card by-category tiene tabs Barra y Línea", () => {
    renderPage();
    // by-category tiene los tabs Barra/Línea.
    expect(screen.getByRole("tab", { name: "Barra" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Línea" })).toBeInTheDocument();
  });
});

describe("ReportesPage — quitar card", () => {
  const existingCards: ReportCardConfig[] = [
    { id: "card-1", type: "income-expense", year: 2026, categoryIds: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("al quitar una card, llama a setPreferences con el array sin esa card", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook(existingCards, setPreferences);
    renderPage();

    // Clic en botón quitar (X)
    fireEvent.click(screen.getByRole("button", { name: /quitar reporte/i }));

    // Confirmar en el popover
    const confirmBtn = screen.getAllByText("Quitar").find(
      (el) => el.closest("[role='dialog']")
    );
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(callArg.reports).toHaveLength(0);
  });
});

describe("ReportesPage — navegación de año de card", () => {
  const existingCards: ReportCardConfig[] = [
    { id: "card-1", type: "income-expense", year: 2026, categoryIds: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("al navegar ‹ de una card, llama a setPreferences con el año actualizado", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    // earliestYear=2025 → ‹ habilitado en 2026
    const { useReports } = await import("@/hooks/use-reports");
    vi.mocked(useReports).mockReturnValue({
      data: {
        year: 2026,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: `2026-${String(i + 1).padStart(2, "0")}`,
          incomeCents: 0,
          expenseCents: 0,
        })),
        categories: [],
        earliestYear: 2025,
      },
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReports>);

    makePreferencesHook(existingCards, setPreferences);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(callArg.reports?.[0]?.year).toBe(2025);
  });
});

// ─── Modo orden de cards (Ola 2, P1) ─────────────────────────────────────────

describe("ReportesPage — modo orden (P1)", () => {
  const twoCards: ReportCardConfig[] = [
    { id: "card-1", type: "income-expense", year: 2026, categoryIds: null },
    { id: "card-2", type: "by-category", year: 2026, categoryIds: null },
  ];
  const oneCard: ReportCardConfig[] = [
    { id: "card-1", type: "income-expense", year: 2026, categoryIds: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("NO muestra el toggle 'Ordenar reportes' en estado vacío", () => {
    makePreferencesHook([]);
    renderPage();
    expect(
      screen.queryByRole("button", { name: /ordenar reportes/i }),
    ).not.toBeInTheDocument();
  });

  it("NO muestra el toggle 'Ordenar reportes' con una sola card", () => {
    makePreferencesHook(oneCard);
    renderPage();
    expect(
      screen.queryByRole("button", { name: /ordenar reportes/i }),
    ).not.toBeInTheDocument();
  });

  it("SÍ muestra el toggle 'Ordenar reportes' con 2+ cards", () => {
    makePreferencesHook(twoCards);
    renderPage();
    expect(
      screen.getByRole("button", { name: /ordenar reportes/i }),
    ).toBeInTheDocument();
  });

  it("al clicar 'Ordenar reportes', el botón cambia a 'Listo'", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    expect(screen.getByRole("button", { name: /listo/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ordenar reportes/i }),
    ).not.toBeInTheDocument();
  });

  it("al clicar 'Listo', el botón vuelve a 'Ordenar reportes'", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));
    fireEvent.click(screen.getByRole("button", { name: /listo/i }));

    expect(
      screen.getByRole("button", { name: /ordenar reportes/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /listo/i }),
    ).not.toBeInTheDocument();
  });

  it("en modo orden aparecen los grips 'Arrastrar reporte'", () => {
    makePreferencesHook(twoCards);
    renderPage();

    // Fuera del modo orden no hay grips
    expect(screen.queryByLabelText("Arrastrar reporte")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // En modo orden aparece uno por card
    const grips = screen.getAllByLabelText("Arrastrar reporte");
    expect(grips).toHaveLength(2);
  });

  it("en modo orden los mini-ítems muestran las etiquetas de tipo actualizadas", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // Etiquetas de tipo del mini-ítem (actualizadas)
    expect(screen.getByText("Ingresos vs Gastos")).toBeInTheDocument();
    expect(screen.getByText("Gastos por categoría")).toBeInTheDocument();
  });

  it("en modo orden el '[+]' compacto tiene opacity-45 (atenuado)", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // El wrapper del [+] compacto debe tener la clase de atenuación
    const addBtn = screen.getByRole("button", { name: /agregar reporte/i });
    const wrapper = addBtn.parentElement;
    expect(wrapper?.className).toContain("opacity-45");
    expect(wrapper?.className).toContain("pointer-events-none");
  });

  it("en modo orden NO se muestran los controles internos de las cards (tablist de by-category)", () => {
    makePreferencesHook(twoCards);
    renderPage();

    // Fuera del modo orden, la card by-category tiene el tablist "Representación del reporte"
    expect(
      screen.queryByRole("tablist", { name: /representación del reporte/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // En modo orden las cards están colapsadas al mini — sin tablist
    expect(
      screen.queryByRole("tablist", { name: /representación del reporte/i }),
    ).not.toBeInTheDocument();
  });

  it("al salir del modo orden los controles internos de las cards vuelven (by-category)", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));
    fireEvent.click(screen.getByRole("button", { name: /listo/i }));

    expect(
      screen.getByRole("tablist", { name: /representación del reporte/i }),
    ).toBeInTheDocument();
  });

  it("en modo orden los títulos/placeholders se muestran en los mini-ítems", () => {
    makePreferencesHook(twoCards);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // Los placeholders "Reporte 1" y "Reporte 2" deben aparecer en los mini-ítems
    expect(screen.getByText("Reporte 1")).toBeInTheDocument();
    expect(screen.getByText("Reporte 2")).toBeInTheDocument();
  });

  it("con título propio, el mini-ítem muestra el título del usuario", () => {
    const cardsWithTitle: ReportCardConfig[] = [
      { id: "card-1", type: "income-expense", year: 2026, categoryIds: null, title: "Mi reporte" },
      { id: "card-2", type: "by-category", year: 2026, categoryIds: null },
    ];
    makePreferencesHook(cardsWithTitle);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    expect(screen.getByText("Mi reporte")).toBeInTheDocument();
  });
});

describe("ReportesPage — agregar card unique-grid (Ola 3, P2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("el menú de tipo muestra la opción 'Gastos Únicos'", () => {
    makePreferencesHook([]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    expect(screen.getByText("Gastos Únicos")).toBeInTheDocument();
    expect(screen.getByText("Grilla día × mes de gastos únicos")).toBeInTheDocument();
  });

  it("al elegir 'Gastos Únicos' llama a setPreferences con una card unique-grid", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    fireEvent.click(screen.getByText("Gastos Únicos"));

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(Array.isArray(callArg.reports)).toBe(true);
    expect(callArg.reports?.[0]?.type).toBe("unique-grid");
    expect(callArg.reports?.[0]?.year).toBe(2026);
    expect(callArg.reports?.[0]?.categoryIds).toBeNull();
  });
});

describe("ReportesPage — modo orden con unique-grid (Ola 3, P2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("el mini-ítem de unique-grid muestra la etiqueta 'Gastos Únicos'", () => {
    const cardsWithUnicoGrid: ReportCardConfig[] = [
      { id: "card-1", type: "unique-grid", year: 2026, categoryIds: null },
      { id: "card-2", type: "income-expense", year: 2026, categoryIds: null },
    ];
    makePreferencesHook(cardsWithUnicoGrid);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    expect(screen.getByText("Gastos Únicos")).toBeInTheDocument();
    expect(screen.getByText("Ingresos vs Gastos")).toBeInTheDocument();
  });
});

// ─── Migración del blob (categoryBreakdown → categoryChartMode) ────────────────

describe("ReportesPage — migración del blob categoryBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("income-expense con categoryBreakdown=true se migra a by-category con categoryChartMode='line'", () => {
    // Simular un blob viejo con una card income-expense + categoryBreakdown=true
    const oldCards = [
      {
        id: "card-old",
        type: "income-expense" as const,
        year: 2026,
        categoryIds: null,
        categoryBreakdown: true,
        title: "Mi reporte viejo",
      },
    ];
    makePreferencesHook(oldCards as ReportCardConfig[]);
    renderPage();

    // La card migrada debe ser by-category con tablist "Representación del reporte"
    // (ya que la normalización la convirtió en by-category + line al leer el blob)
    expect(screen.getByRole("tablist", { name: /representación del reporte/i })).toBeInTheDocument();
    // El título propio se conserva
    expect(screen.getByText("Mi reporte viejo")).toBeInTheDocument();
  });

  it("income-expense con categoryBreakdown=false queda como income-expense (Total-only)", () => {
    const oldCards = [
      {
        id: "card-old",
        type: "income-expense" as const,
        year: 2026,
        categoryIds: null,
        categoryBreakdown: false,
      },
    ];
    makePreferencesHook(oldCards as ReportCardConfig[]);
    renderPage();

    // income-expense Total-only: sin tablist de vista
    expect(screen.queryByRole("tablist", { name: /vista del reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /representación del reporte/i })).not.toBeInTheDocument();
  });

  it("by-category sin categoryChartMode se trata como 'bar' (default)", () => {
    const oldCards = [
      {
        id: "card-old",
        type: "by-category" as const,
        year: 2026,
        categoryIds: null,
        // sin categoryChartMode
      },
    ];
    makePreferencesHook(oldCards as ReportCardConfig[]);
    renderPage();

    // by-category sin categoryChartMode → default "bar" → tab Barra aria-selected=true
    expect(screen.getByRole("tab", { name: "Barra" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Línea" })).toHaveAttribute("aria-selected", "false");
  });
});

describe("ReportesPage — chip de moneda default (Fase 1.2.3-ext)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    makePreferencesHook([]);
  });

  it("el chip de moneda aparece en el header de /reportes (ARS por defecto)", () => {
    renderPage();
    const chip = screen.getByRole("link", { name: /moneda por defecto: ARS/i });
    expect(chip).toBeInTheDocument();
  });

  it("el chip es un link a /configuracion", () => {
    renderPage();
    const chip = screen.getByRole("link", { name: /moneda por defecto: ARS/i });
    expect(chip).toHaveAttribute("href", "/configuracion");
  });

  it("el chip muestra el texto del código de moneda 'ARS'", () => {
    renderPage();
    const chip = screen.getByRole("link", { name: /moneda por defecto: ARS/i });
    expect(chip).toHaveTextContent("ARS");
  });
});

// ─── Tests: menú "[+]" — 5ª entrada Inflación vs Ingresos (Ola 4, P5) ─────────

describe("ReportesPage — menú AddCard, 5ª entrada 'Inflación vs Ingresos'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    makePreferencesHook([]);
  });

  it("el menú de tipo incluye 'Inflación vs Ingresos' cuando se abre", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    expect(screen.getByText("Inflación vs Ingresos")).toBeInTheDocument();
  });

  it("el menú muestra la sub-descripción de Inflación vs Ingresos", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    expect(
      screen.getByText(/variación de tus ingresos frente a la inflación/i),
    ).toBeInTheDocument();
  });

  it("al elegir 'Inflación vs Ingresos' llama a setPreferences con una card inflation-income", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    fireEvent.click(screen.getByText("Inflación vs Ingresos"));

    await waitFor(() => {
      expect(setPreferences).toHaveBeenCalledTimes(1);
    });

    const callArg = setPreferences.mock.calls[0]?.[0] as UserPreferences;
    expect(Array.isArray(callArg.reports)).toBe(true);
    expect(callArg.reports).toHaveLength(1);
    expect(callArg.reports?.[0]?.type).toBe("inflation-income");
    expect(callArg.reports?.[0]?.year).toBe(2026);
    expect(callArg.reports?.[0]?.categoryIds).toBeNull();
  });
});

// ─── Tests: normalización del blob con tipo inflation-income ──────────────────

describe("ReportesPage — normalización del blob con 'inflation-income'", () => {
  const inflationIncomeCard: ReportCardConfig = {
    id: "card-inf-1",
    type: "inflation-income",
    year: 2026,
    categoryIds: null,
    currency: "ARS",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("acepta y renderiza cards de tipo inflation-income sin normalization error", () => {
    makePreferencesHook([inflationIncomeCard]);
    renderPage();
    // La card de inflation-income se monta (skeleton de carga visible)
    expect(screen.getByRole("status", { name: /cargando/i })).toBeInTheDocument();
  });

  it("el mini de reorden muestra 'Inflación vs Ingresos' para tipo inflation-income", () => {
    makePreferencesHook([
      inflationIncomeCard,
      { id: "card-2", type: "income-expense", year: 2025, categoryIds: null },
    ]);
    renderPage();

    // Entrar en modo orden
    fireEvent.click(screen.getByRole("button", { name: /ordenar reportes/i }));

    // La etiqueta de tipo del mini para inflation-income debe ser "Inflación vs Ingresos"
    expect(screen.getByText("Inflación vs Ingresos")).toBeInTheDocument();
  });

  it("cards inflation-income con campos opcionales (title, currency) se normalizan sin error", () => {
    const cardWithExtras: ReportCardConfig = {
      ...inflationIncomeCard,
      title: "Mi inflación 2026",
      currency: "USD",
    };
    makePreferencesHook([cardWithExtras]);
    renderPage();
    expect(screen.getByText("Mi inflación 2026")).toBeInTheDocument();
  });
});
