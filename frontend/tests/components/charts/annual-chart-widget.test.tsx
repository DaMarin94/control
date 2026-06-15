/**
 * Tests del AnnualChartWidget (RF-GRA-001/002/003).
 *
 * Verifica:
 * - Estado de carga (skeleton)
 * - Estado de error + botón Reintentar
 * - Estado vacío (año sin movimientos)
 * - Forma 1 y Forma 2 toggle
 * - Stepper: ‹ deshabilitado en earliestYear, › deshabilitado en año actual
 * - Stepper: ‹ habilitado cuando hay años anteriores
 * - Con navigable=false no se muestra el control de año
 * - Con navigable=true se muestra el stepper
 * - La leyenda muestra los ítems correctos en cada forma
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AnnualMovementsResponse } from "@/types/annual";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock de useAnnual
vi.mock("@/hooks/use-annual", () => ({
  useAnnual: vi.fn(),
  ANNUAL_QUERY_KEY: (year: number) => ["annual", year],
}));

// Mock de useApi (requerido internamente)
vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

// Mock de Recharts para evitar errores de ResizeObserver en jsdom
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

import { useAnnual } from "@/hooks/use-annual";
import { AnnualChartWidget } from "@/components/charts/annual-chart-widget";

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

function renderWidget(props: Partial<React.ComponentProps<typeof AnnualChartWidget>> = {}) {
  const defaultProps = {
    year: 2026,
    navigable: false,
    onYearChange: vi.fn(),
    chartHeight: 280,
  };
  return render(<AnnualChartWidget {...defaultProps} {...props} />, {
    wrapper: createWrapper(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnnualChartWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Estado de carga ────────────────────────────────────────────────────────

  describe("Estado de carga (skeleton)", () => {
    it("muestra el skeleton mientras carga", () => {
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

      renderWidget();

      // Cabecera siempre presente (eyebrow "Resumen anual")
      expect(screen.getByText("Resumen anual")).toBeInTheDocument();
      // No se muestra el gráfico ni error
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra el toggle de forma incluso cargando", () => {
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

      renderWidget();

      expect(screen.getByRole("button", { name: /ingresos y gastos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /por categoría/i })).toBeInTheDocument();
    });
  });

  // ── Estado de error ────────────────────────────────────────────────────────

  describe("Estado de error", () => {
    it("muestra el mensaje de error", () => {
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

      renderWidget();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/no se pudo cargar el gráfico/i)).toBeInTheDocument();
    });

    it("muestra el botón Reintentar en estado de error", () => {
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

      renderWidget();

      const retryBtn = screen.getByRole("button", { name: /reintentar/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // ── Estado vacío ───────────────────────────────────────────────────────────

  describe("Estado vacío (año sin movimientos)", () => {
    it("muestra mensaje 'Sin movimientos en 2026' cuando el año está vacío", () => {
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

      renderWidget({ year: 2026 });

      expect(screen.getByText(/sin movimientos en 2026/i)).toBeInTheDocument();
    });
  });

  // ── Con datos ─────────────────────────────────────────────────────────────

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

    it("renderiza el título 'Resumen anual'", () => {
      renderWidget();
      expect(screen.getByText("Resumen anual")).toBeInTheDocument();
    });

    it("la Forma 1 es la forma por defecto (aria-pressed=true)", () => {
      renderWidget();
      const btn1 = screen.getByRole("button", { name: /ingresos y gastos/i });
      expect(btn1).toHaveAttribute("aria-pressed", "true");
      const btn2 = screen.getByRole("button", { name: /por categoría/i });
      expect(btn2).toHaveAttribute("aria-pressed", "false");
    });

    it("la leyenda en Forma 1 muestra Ingresos y Gastos", () => {
      renderWidget();
      expect(screen.getByText("Ingresos")).toBeInTheDocument();
      expect(screen.getByText("Gastos")).toBeInTheDocument();
    });

    it("al hacer toggle a Forma 2, el botón cambia a aria-pressed=true", () => {
      renderWidget();

      const btn2 = screen.getByRole("button", { name: /por categoría/i });
      fireEvent.click(btn2);

      expect(btn2).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /ingresos y gastos/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("la leyenda en Forma 2 muestra los nombres de categorías", () => {
      renderWidget();

      // Cambiar a Forma 2
      fireEvent.click(screen.getByRole("button", { name: /por categoría/i }));

      expect(screen.getByText("Alimentación")).toBeInTheDocument();
      expect(screen.getByText("Transporte")).toBeInTheDocument();
    });

    it("no muestra el stepper cuando navigable=false", () => {
      renderWidget({ navigable: false });
      expect(screen.queryByRole("group", { name: /navegación de año/i })).not.toBeInTheDocument();
    });

    it("con navigable=false muestra el año como cifra suelta", () => {
      renderWidget({ navigable: false, year: 2026 });
      // El año aparece como texto "2026" en la zona izquierda
      expect(screen.getByText("2026")).toBeInTheDocument();
    });
  });

  // ── Stepper de año ────────────────────────────────────────────────────────

  describe("Stepper de año (navigable=true)", () => {
    it("muestra el stepper cuando navigable=true", () => {
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

      renderWidget({ navigable: true, year: 2026 });

      expect(screen.getByRole("group", { name: /navegación de año/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /año anterior/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /año siguiente/i })).toBeInTheDocument();
    });

    it("‹ está deshabilitado cuando el año es el earliestYear", () => {
      // earliestYear = 2025, year = 2025 → no puede ir más atrás
      const dataWithEarliest: AnnualMovementsResponse = {
        ...mockAnnualData,
        earliestYear: 2025,
      };
      mockUseAnnual.mockReturnValue({
        data: dataWithEarliest,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderWidget({ navigable: true, year: 2025 });

      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).toBeDisabled();
    });

    it("‹ está habilitado cuando hay años anteriores al earliestYear", () => {
      const dataWithEarliest: AnnualMovementsResponse = {
        ...mockAnnualData,
        earliestYear: 2024,
      };
      mockUseAnnual.mockReturnValue({
        data: dataWithEarliest,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      // year = 2026, earliestYear = 2024 → puede ir a 2025 y 2024
      renderWidget({ navigable: true, year: 2026 });

      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).not.toBeDisabled();
    });

    it("› está deshabilitado cuando el año es el año actual", async () => {
      // Usamos 2026 como año actual (mockeado implícito por Date de jsdom)
      // El widget calcula currentYear con new Date().getFullYear()
      const currentYear = new Date().getFullYear();

      mockUseAnnual.mockReturnValue({
        data: { ...mockAnnualData, year: currentYear },
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderWidget({ navigable: true, year: currentYear });

      const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
      expect(nextBtn).toBeDisabled();
    });

    it("› llama onYearChange(year + 1) cuando está habilitado", () => {
      const onYearChange = vi.fn();
      const dataWithEarliest: AnnualMovementsResponse = {
        ...mockAnnualData,
        earliestYear: 2020,
      };
      mockUseAnnual.mockReturnValue({
        data: dataWithEarliest,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      // year = 2020 (un año en el pasado, › debería estar habilitado)
      renderWidget({ navigable: true, year: 2020, onYearChange });

      const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
      fireEvent.click(nextBtn);
      expect(onYearChange).toHaveBeenCalledWith(2021);
    });

    it("‹ llama onYearChange(year - 1) cuando está habilitado", () => {
      const onYearChange = vi.fn();
      const dataWithEarliest: AnnualMovementsResponse = {
        ...mockAnnualData,
        earliestYear: 2020,
      };
      mockUseAnnual.mockReturnValue({
        data: dataWithEarliest,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      // year = 2022, earliestYear = 2020 → ‹ habilitado
      renderWidget({ navigable: true, year: 2022, onYearChange });

      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      fireEvent.click(prevBtn);
      expect(onYearChange).toHaveBeenCalledWith(2021);
    });
  });
});
