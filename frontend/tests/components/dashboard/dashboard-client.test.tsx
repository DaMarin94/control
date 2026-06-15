/**
 * Tests del DashboardClient (RF-DASH-001/002/003/005).
 *
 * Verifica:
 * - Estado de carga (skeleton)
 * - Estado con datos: resumen financiero con totales
 * - Estado vacío: totales en cero + CTA "Cargá tu primer movimiento"
 * - Estado de error: mensaje sin romper la pantalla
 * - Enlace "Ver todos" apunta al mes actual (/mes?month=YYYY-MM)
 * - El widget de gráfico anual se monta con navigable=false (RF-GRA-002)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock del hook useMovements
vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string) => ["movements", month],
}));

// Mock del widget AnnualChartWidget — evita cargar Recharts en los tests del dashboard
vi.mock("@/components/charts/annual-chart-widget", () => ({
  AnnualChartWidget: ({ year, navigable }: { year: number; navigable: boolean }) => (
    <div
      data-testid="annual-chart-widget"
      data-year={year}
      data-navigable={String(navigable)}
    />
  ),
}));

// Mock del hook useApi (requerido por TransactionModal/TransactionForm vía NewTransactionButton)
vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    },
    token: "test-token",
  })),
}));

// Mock de useToast
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  })),
}));

// Mock de next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

// Mock de getCurrentMonth para tests deterministas
vi.mock("@/lib/format", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...original,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

import { useMovements } from "@/hooks/use-movements";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

const mockUseMovements = vi.mocked(useMovements);

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

function renderDashboard() {
  return render(<DashboardClient />, { wrapper: createWrapper() });
}

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockWithMovements: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 15000, incomeCents: 50000, balanceCents: 35000 },
  movements: {
    unicos: [
      {
        id: "mov-1",
        origin: "unico",
        type: "EXPENSE",
        amountCents: 15000,
        description: "Almuerzo",
        occurredAt: "2026-06-17T17:30:00.000Z",
        timezone: "America/Argentina/Buenos_Aires",
        installment: null,
        category: { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" },
      },
    ],
    fijos: [],
    cuotas: [],
  },
};

const mockEmpty: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 0, incomeCents: 0, balanceCents: 0 },
  movements: { unicos: [], fijos: [], cuotas: [] },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Estado de carga", () => {
    it("muestra el indicador de carga mientras obtiene los totales", () => {
      mockUseMovements.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isPending: true,
        isSuccess: false,
        error: null,
        status: "pending",
        fetchStatus: "fetching",
      } as ReturnType<typeof useMovements>);

      renderDashboard();

      expect(screen.getByLabelText("Cargando totales")).toBeInTheDocument();
    });
  });

  describe("Estado con datos", () => {
    beforeEach(() => {
      mockUseMovements.mockReturnValue({
        data: mockWithMovements,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
      } as ReturnType<typeof useMovements>);
    });

    it("muestra el mes actual en el encabezado", () => {
      renderDashboard();
      // "Junio" aparece en el encabezado h1 y en el balance hero (can be multiple)
      const junioElements = screen.getAllByText(/junio/i);
      expect(junioElements.length).toBeGreaterThanOrEqual(1);
    });

    it("muestra el total de gastos", () => {
      renderDashboard();
      // $150,00 aparece en la tarjeta de gastos y en la leyenda del balance hero
      const gastos = screen.getAllByText("$150,00");
      expect(gastos.length).toBeGreaterThanOrEqual(1);
    });

    it("muestra el total de ingresos", () => {
      renderDashboard();
      // $500,00 aparece en la tarjeta de ingresos y en la leyenda del balance hero
      const ingresos = screen.getAllByText("$500,00");
      expect(ingresos.length).toBeGreaterThanOrEqual(1);
    });

    it("muestra el balance positivo", () => {
      renderDashboard();
      // El balance positivo se muestra como "+ $350,00" en el hero card
      expect(screen.getByText("+ $350,00")).toBeInTheDocument();
    });

    it("el enlace 'Ver todos' apunta a /mes?month=2026-06", () => {
      renderDashboard();
      const link = screen.getByText(/ver todos/i);
      expect(link.closest("a")).toHaveAttribute("href", "/mes?month=2026-06");
    });

    it("no muestra el estado vacío cuando hay movimientos", () => {
      renderDashboard();
      expect(screen.queryByText(/cargá tu primer movimiento/i)).not.toBeInTheDocument();
    });

    it("monta el widget de gráfico anual con navigable=false (RF-GRA-002)", () => {
      renderDashboard();
      const widget = screen.getByTestId("annual-chart-widget");
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveAttribute("data-navigable", "false");
    });

    it("el widget de gráfico anual recibe el año actual", () => {
      renderDashboard();
      const widget = screen.getByTestId("annual-chart-widget");
      // El año viene de getCurrentMonth mockeado como "2026-06" → año 2026
      expect(widget).toHaveAttribute("data-year", "2026");
    });
  });

  describe("Estado vacío", () => {
    beforeEach(() => {
      mockUseMovements.mockReturnValue({
        data: mockEmpty,
        isLoading: false,
        isError: false,
        isPending: false,
        isSuccess: true,
        error: null,
        status: "success",
        fetchStatus: "idle",
      } as ReturnType<typeof useMovements>);
    });

    it("muestra los totales en cero", () => {
      renderDashboard();
      // Hay 3 tarjetas con $0,00 (gastos, ingresos, balance)
      const zeroCurrencies = screen.getAllByText("$0,00");
      expect(zeroCurrencies.length).toBeGreaterThanOrEqual(3);
    });

    it("muestra el CTA 'Cargá tu primer movimiento'", () => {
      renderDashboard();
      expect(screen.getByText(/cargá tu primer movimiento/i)).toBeInTheDocument();
    });

    it("el CTA 'Cargá tu primer movimiento' es un botón clickeable", () => {
      renderDashboard();
      const cta = screen.getByText(/cargá tu primer movimiento/i);
      expect(cta.tagName).toBe("BUTTON");
    });
  });

  describe("Estado de error", () => {
    it("muestra mensaje de error sin romper la pantalla", () => {
      mockUseMovements.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isPending: false,
        isSuccess: false,
        error: new Error("Network error"),
        status: "error",
        fetchStatus: "idle",
      } as ReturnType<typeof useMovements>);

      renderDashboard();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/no se pudieron cargar/i);
    });
  });
});
