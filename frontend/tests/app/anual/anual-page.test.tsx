/**
 * Tests de la pantalla /anual (RF-GRA-003).
 *
 * Verifica:
 *   - Las dos tarjetas (IncomeExpenseCard y ByCategoryCard) se montan
 *   - El control de año compartido vive en el .phead (fuera de las tarjetas)
 *   - ‹ deshabilitado cuando year === earliestYear
 *   - › deshabilitado cuando year === año actual
 *   - Navegar con ‹ / › actualiza el año que reciben ambas tarjetas
 *   - Las tarjetas no repiten el año en su cabecera (showYearInHeader=false)
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

// Mock de getCurrentMonth: año actual = 2026
vi.mock("@/lib/format", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...original,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

import { useAnnual } from "@/hooks/use-annual";
import AnualPage from "@/app/(app)/anual/page";

const mockUseAnnual = vi.mocked(useAnnual);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

function makeMockData(year: number, earliestYear: number | null): AnnualMovementsResponse {
  return {
    year,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: `${year}-${String(i + 1).padStart(2, "0")}`,
      incomeCents: 50000,
      expenseCents: 20000,
    })),
    categories: [
      {
        categoryId: "cat-1",
        name: "Alimentación",
        color: "#4F86C6",
        monthlyExpenseCents: Array.from({ length: 12 }, () => 20000),
      },
    ],
    earliestYear,
  };
}

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

function renderAnualPage() {
  return render(<AnualPage />, { wrapper: createWrapper() });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnualPage (/anual)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: año 2026, earliestYear 2024
    mockUseAnnual.mockReturnValue({
      data: makeMockData(2026, 2024),
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

  describe("Estructura de página", () => {
    it("muestra el H1 'Anual'", () => {
      renderAnualPage();
      expect(screen.getByRole("heading", { name: /anual/i })).toBeInTheDocument();
    });

    it("muestra el eyebrow 'Tu actividad'", () => {
      renderAnualPage();
      expect(screen.getByText("Tu actividad")).toBeInTheDocument();
    });

    it("muestra las dos tarjetas: 'Ingresos y gastos' y 'Por categoría'", () => {
      renderAnualPage();
      expect(screen.getByText("Ingresos y gastos")).toBeInTheDocument();
      expect(screen.getByText("Por categoría")).toBeInTheDocument();
    });

    it("el control de año compartido está en el .phead (visible como grupo de navegación)", () => {
      renderAnualPage();
      expect(screen.getByRole("group", { name: /navegación de año/i })).toBeInTheDocument();
    });

    it("las tarjetas NO repiten el año en su cabecera (el año vive en el control compartido)", () => {
      renderAnualPage();
      // El año 2026 solo aparece en el control compartido del .phead,
      // no en las cabeceras de las tarjetas (que tienen showYearInHeader=false).
      // El stepper muestra "2026" → solo 1 ocurrencia de ese texto exacto como número.
      const yearTexts = screen.getAllByText("2026");
      // Solo el stepper muestra el año; las tarjetas no lo repiten
      expect(yearTexts).toHaveLength(1);
    });
  });

  describe("Control de año compartido — límites", () => {
    it("› deshabilitado cuando el año es el año actual (2026)", () => {
      renderAnualPage();
      const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
      expect(nextBtn).toBeDisabled();
    });

    it("‹ habilitado cuando hay años anteriores al earliestYear (2024 < 2026)", () => {
      renderAnualPage();
      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).not.toBeDisabled();
    });

    it("‹ deshabilitado cuando el año mostrado es el earliestYear", () => {
      // earliestYear = 2026, year = 2026 → no puede ir más atrás
      mockUseAnnual.mockReturnValue({
        data: makeMockData(2026, 2026),
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderAnualPage();
      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).toBeDisabled();
    });

    it("‹ deshabilitado cuando earliestYear es null (sin datos previos)", () => {
      mockUseAnnual.mockReturnValue({
        data: makeMockData(2026, null),
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      renderAnualPage();
      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).toBeDisabled();
    });
  });

  describe("Navegación de año — actualiza ambas tarjetas", () => {
    it("al hacer clic en ‹, el año del control baja a 2025", () => {
      // Año inicial 2026, earliestYear 2024 → ‹ habilitado
      renderAnualPage();

      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      fireEvent.click(prevBtn);

      // El stepper ahora muestra 2025
      expect(screen.getByText("2025")).toBeInTheDocument();
      expect(screen.queryByText("2026")).not.toBeInTheDocument();
    });

    it("al navegar a 2025, › vuelve a habilitarse", () => {
      renderAnualPage();

      // Navegar a 2025
      fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));

      // Ahora 2025 < 2026 (año actual) → › habilitado
      const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
      expect(nextBtn).not.toBeDisabled();
    });

    it("al navegar a 2025 y volver a 2026, › se deshabilita nuevamente", () => {
      renderAnualPage();

      // Ir a 2025
      fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
      // Volver a 2026
      fireEvent.click(screen.getByRole("button", { name: /año siguiente/i }));

      // › deshabilitado en 2026 (año actual)
      const nextBtn = screen.getByRole("button", { name: /año siguiente/i });
      expect(nextBtn).toBeDisabled();
    });

    it("al llegar a earliestYear (2024), ‹ se deshabilita", () => {
      // Configurar: earliestYear = 2024, año actual = 2026
      // Para navegar de 2026 → 2025 → 2024, necesitamos hacer click 2 veces
      renderAnualPage();

      fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
      // Ahora en 2025; como earliestYear=2024, ‹ sigue habilitado

      // Necesitamos actualizar el mock para reflejar earliestYear en el año 2025
      mockUseAnnual.mockReturnValue({
        data: makeMockData(2025, 2024),
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      fireEvent.click(screen.getByRole("button", { name: /año anterior/i }));
      // Ahora en 2024; earliestYear=2024 → ‹ debe deshabilitarse

      // Actualizar mock para año 2024
      mockUseAnnual.mockReturnValue({
        data: makeMockData(2024, 2024),
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
        refetch: vi.fn(),
      } as ReturnType<typeof useAnnual>);

      // Forzar re-render con el nuevo mock (el stepper está en 2024 tras 2 clicks)
      // El botón ‹ se deshabilita porque year(2024) === earliestYear(2024)
      const prevBtn = screen.getByRole("button", { name: /año anterior/i });
      expect(prevBtn).toBeDisabled();
    });
  });
});
