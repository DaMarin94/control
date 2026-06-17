/**
 * Tests de la pantalla /reportes (Fase 1.1.5, RF-REP-003/004).
 *
 * Verifica:
 * - Estado vacío inicial: H1 "Reportes", eyebrow, recuadro "[+]" grande
 * - Al hacer clic en "[+]" se abre el menú de tipo (Ingresos y gastos / Por categoría)
 * - Al elegir un tipo se agrega una card y se llama a setPreferences
 * - Con cards: cards renderizadas + "[+]" compacto al final
 * - Quitar card llama a setPreferences con el array sin esa card
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ReportCardConfig } from "@/types/reports";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
  REPORTS_QUERY_KEY: (year: number, key: string | null) => ["reports", year, key],
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
    Area: () => null,
    Bar: () => null,
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

  it("al hacer clic en '[+]' muestra el menú de tipo", () => {
    makePreferencesHook([]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    expect(screen.getByText("Ingresos y gastos")).toBeInTheDocument();
    expect(screen.getByText("Por categoría")).toBeInTheDocument();
  });

  it("al elegir 'Ingresos y gastos' llama a setPreferences con una card income-expense", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    // Abrir menú
    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    // Elegir tipo
    fireEvent.click(screen.getAllByText("Ingresos y gastos")[0]!);

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

  it("al elegir 'Por categoría' llama a setPreferences con una card by-category", async () => {
    const setPreferences = vi.fn().mockResolvedValue({ success: true });
    makePreferencesHook([], setPreferences);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /agregar primer reporte/i }));
    fireEvent.click(screen.getAllByText("Por categoría")[0]!);

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

  it("muestra el eyebrow 'Reporte' (cabecera de las cards) para cada card", () => {
    renderPage();
    const eyebrows = screen.getAllByText("Reporte");
    expect(eyebrows).toHaveLength(2);
  });

  it("muestra los títulos de las cards", () => {
    renderPage();
    expect(screen.getByText("Ingresos y gastos")).toBeInTheDocument();
    expect(screen.getByText("Por categoría")).toBeInTheDocument();
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
