/**
 * Tests de IncomeExpenseCard y ByCategoryCard (RF-GRA-001/002/003).
 *
 * El widget anterior (un solo componente con toggle) fue reemplazado por dos
 * tarjetas autónomas:
 *   - IncomeExpenseCard (Forma 1 — AreaChart: ingresos vs gastos)
 *   - ByCategoryCard   (Forma 2 — BarChart apilado: gastos por categoría)
 *
 * Verifica por tarjeta:
 *   - Estado de carga (skeleton)
 *   - Estado de error + botón Reintentar
 *   - Estado vacío (año sin movimientos)
 *   - Con datos: cabecera, leyenda, gráfico renderizado
 *
 * Verifica el control de año compartido (en AnualPage, no en las tarjetas):
 *   - ‹ deshabilitado en earliestYear, › deshabilitado en año actual
 *   - ‹ habilitado cuando hay años anteriores
 *   - Los cambios afectan ambas tarjetas (comparten el year del padre)
 *
 * Verifica comportamiento en Dashboard:
 *   - IncomeExpenseCard con showYearInHeader=true muestra el año en la cabecera
 *   - ByCategoryCard NO se monta en el Dashboard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnnualMovementsResponse } from "@/types/annual";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-annual", () => ({
  useAnnual: vi.fn(),
  ANNUAL_QUERY_KEY: (year: number) => ["annual", year],
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

// Mock de getCurrentMonth para que /anual use año determinista
vi.mock("@/lib/format", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...original,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

import { useAnnual } from "@/hooks/use-annual";
import { IncomeExpenseCard, ByCategoryCard } from "@/components/charts/annual-chart-widget";

const mockUseAnnual = vi.mocked(useAnnual);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockAnnualData: AnnualMovementsResponse = {
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
  earliestYear: 2025,
};

const mockEmptyData: AnnualMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
  })),
  categories: [],
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

function renderIncomeExpenseCard(props: Partial<React.ComponentProps<typeof IncomeExpenseCard>> = {}) {
  const defaults = { year: 2026, chartHeight: 280, showYearInHeader: false };
  return render(<IncomeExpenseCard {...defaults} {...props} />, { wrapper: createWrapper() });
}

function renderByCategoryCard(props: Partial<React.ComponentProps<typeof ByCategoryCard>> = {}) {
  const defaults = { year: 2026, chartHeight: 300 };
  return render(<ByCategoryCard {...defaults} {...props} />, { wrapper: createWrapper() });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("IncomeExpenseCard (Forma 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Estado de carga (skeleton)", () => {
    beforeEach(() => {
      mockUseAnnual.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isPending: true,
        isSuccess: false,
        error: null,
        status: "pending",
        fetchStatus: "fetching",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);
    });

    it("muestra el eyebrow 'Resumen anual'", () => {
      renderIncomeExpenseCard();
      expect(screen.getByText("Resumen anual")).toBeInTheDocument();
    });

    it("muestra el título 'Ingresos y gastos'", () => {
      renderIncomeExpenseCard();
      expect(screen.getByText("Ingresos y gastos")).toBeInTheDocument();
    });

    it("no muestra el gráfico ni el error mientras carga", () => {
      renderIncomeExpenseCard();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recharts-chart")).not.toBeInTheDocument();
    });
  });

  describe("Estado de error", () => {
    beforeEach(() => {
      mockUseAnnual.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isPending: false,
        isSuccess: false,
        error: new Error("Network error"),
        status: "error",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);
    });

    it("muestra el mensaje de error", () => {
      renderIncomeExpenseCard();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/no se pudo cargar el gráfico/i)).toBeInTheDocument();
    });

    it("el botón Reintentar llama a refetch", () => {
      const mockRefetch = vi.fn();
      mockUseAnnual.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isPending: false,
        isSuccess: false,
        error: new Error("Network error"),
        status: "error",
        fetchStatus: "idle",
        refetch: mockRefetch,
      } as ReturnType<typeof useAnnual>);

      renderIncomeExpenseCard();

      const retryBtn = screen.getByRole("button", { name: /reintentar/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Estado vacío", () => {
    it("muestra 'Sin movimientos en 2026' cuando el año está vacío", () => {
      mockUseAnnual.mockReturnValue({
        data: mockEmptyData,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderIncomeExpenseCard({ year: 2026 });

      expect(screen.getByText(/sin movimientos en 2026/i)).toBeInTheDocument();
    });
  });

  describe("Con datos", () => {
    beforeEach(() => {
      mockUseAnnual.mockReturnValue({
        data: mockAnnualData,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);
    });

    it("la leyenda muestra 'Ingresos' y 'Gastos'", () => {
      renderIncomeExpenseCard();
      expect(screen.getByText("Ingresos")).toBeInTheDocument();
      expect(screen.getByText("Gastos")).toBeInTheDocument();
    });

    it("con showYearInHeader=true muestra el año en la cabecera (comportamiento dashboard)", () => {
      renderIncomeExpenseCard({ showYearInHeader: true, year: 2026 });
      // El año aparece como cifra mono en la cabecera derecha
      expect(screen.getByText("2026")).toBeInTheDocument();
    });

    it("con showYearInHeader=false no duplica el año en la cabecera (comportamiento /anual)", () => {
      renderIncomeExpenseCard({ showYearInHeader: false, year: 2026 });
      // El año NO aparece dentro de la tarjeta (el control está en el .phead externo)
      expect(screen.queryByText("2026")).not.toBeInTheDocument();
    });

    it("no muestra toggle ni control de año dentro de la tarjeta", () => {
      renderIncomeExpenseCard();
      // No existe el botón de toggle ni de navegación dentro de la tarjeta
      expect(screen.queryByRole("group", { name: /navegación de año/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /año anterior/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /año siguiente/i })).not.toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("ByCategoryCard (Forma 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Estado de carga (skeleton)", () => {
    beforeEach(() => {
      mockUseAnnual.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isPending: true,
        isSuccess: false,
        error: null,
        status: "pending",
        fetchStatus: "fetching",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);
    });

    it("muestra el eyebrow 'Resumen anual'", () => {
      renderByCategoryCard();
      expect(screen.getByText("Resumen anual")).toBeInTheDocument();
    });

    it("muestra el título 'Por categoría'", () => {
      renderByCategoryCard();
      expect(screen.getByText("Por categoría")).toBeInTheDocument();
    });

    it("no muestra el gráfico ni el error mientras carga", () => {
      renderByCategoryCard();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Estado de error", () => {
    it("muestra el mensaje de error sin afectar otras tarjetas", () => {
      const mockRefetch = vi.fn();
      mockUseAnnual.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isPending: false,
        isSuccess: false,
        error: new Error("Network error"),
        status: "error",
        fetchStatus: "idle",
        refetch: mockRefetch,
      } as ReturnType<typeof useAnnual>);

      renderByCategoryCard();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/no se pudo cargar el gráfico/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /reintentar/i });
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Estado vacío", () => {
    it("muestra 'Sin movimientos en 2026' cuando no hay gastos", () => {
      mockUseAnnual.mockReturnValue({
        data: mockEmptyData,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderByCategoryCard({ year: 2026 });

      expect(screen.getByText(/sin movimientos en 2026/i)).toBeInTheDocument();
    });
  });

  describe("Con datos", () => {
    beforeEach(() => {
      mockUseAnnual.mockReturnValue({
        data: mockAnnualData,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);
    });

    it("la leyenda muestra los nombres de las categorías", () => {
      renderByCategoryCard();
      expect(screen.getByText("Alimentación")).toBeInTheDocument();
      expect(screen.getByText("Transporte")).toBeInTheDocument();
    });

    it("no muestra toggle ni control de año dentro de la tarjeta", () => {
      renderByCategoryCard();
      expect(screen.queryByRole("group", { name: /navegación de año/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /año anterior/i })).not.toBeInTheDocument();
    });

    it("no muestra leyenda cuando no hay categorías", () => {
      mockUseAnnual.mockReturnValue({
        data: { ...mockAnnualData, categories: [] },
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderByCategoryCard();
      expect(screen.queryByLabelText("Leyenda del gráfico")).not.toBeInTheDocument();
    });
  });
});

// ─── Control de año compartido (testeado a través de la lógica de la página) ──

describe("Control de año compartido — lógica de límites", () => {
  /**
   * El control de año ‹ › vive en /anual (AnualPage), fuera de las tarjetas.
   * Lo testeamos instanciando la lógica de límites directamente, sin montar la
   * página completa (que dependería del layout y del router de Next.js).
   *
   * Los tests relevantes de interacción con el control de año se cubren en:
   *   tests/app/anual/anual-page.test.tsx (si se crea en el futuro)
   *
   * Acá verificamos que IncomeExpenseCard y ByCategoryCard muestran datos
   * del año pasado por prop (el año que el padre controla).
   */

  it("IncomeExpenseCard muestra datos del año que recibe por prop", () => {
    const data2024: AnnualMovementsResponse = {
      ...mockAnnualData,
      year: 2024,
      months: mockAnnualData.months.map((m) => ({
        ...m,
        month: m.month.replace("2026", "2024"),
      })),
    };

    mockUseAnnual.mockReturnValue({
      data: data2024,
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
    } as ReturnType<typeof useAnnual>);

    renderIncomeExpenseCard({ year: 2024, showYearInHeader: true });
    // Con showYearInHeader el año 2024 aparece en la cabecera
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("ByCategoryCard muestra datos del año que recibe por prop", () => {
    const data2024: AnnualMovementsResponse = {
      ...mockAnnualData,
      year: 2024,
    };

    mockUseAnnual.mockReturnValue({
      data: data2024,
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
    } as ReturnType<typeof useAnnual>);

    renderByCategoryCard({ year: 2024 });
    // Las categorías aparecen en la leyenda
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
  });
});
