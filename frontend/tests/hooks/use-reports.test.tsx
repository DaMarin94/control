/**
 * Tests del hook useReports (Fase 1.1.5).
 *
 * Verifica:
 * - REPORTS_QUERY_KEY genera la query key correcta (varía por año y por categoriesKey)
 * - useReports llama a GET /movements/reports?year=YYYY (sin filtro)
 * - useReports incluye categories= en la URL cuando hay filtro
 * - Estados isLoading/data/isError
 * - enabled: isAuthenticated (no dispara sin autenticación)
 * - El contrato de la respuesta (months × 12, categories con monthlyExpenseCents × 12)
 * - Invariante: suma de monthlyExpenseCents[i] == months[i].expenseCents
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReports, REPORTS_QUERY_KEY } from "@/hooks/use-reports";
import { ApiError } from "@/types/api";
import type { ReportsMovementsResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockReportsResponse: ReportsMovementsResponse = {
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

const mockEmptyReportsResponse: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
  })),
  categories: [],
  earliestYear: null,
};

// ─── Wrapper con QueryClient ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// ─── Tests REPORTS_QUERY_KEY ─────────────────────────────────────────────────

describe("REPORTS_QUERY_KEY", () => {
  it("genera la query key correcta para año sin filtro (null)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).toEqual(["reports", 2026, null]);
  });

  it("genera la query key correcta para año con filtro de categorías", () => {
    expect(REPORTS_QUERY_KEY(2026, "cat-1,cat-2")).toEqual(["reports", 2026, "cat-1,cat-2"]);
  });

  it("query keys de años distintos son distintas", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(REPORTS_QUERY_KEY(2025, null));
  });

  it("query keys con distintos filtros son distintas (refetch al cambiar categorías)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(REPORTS_QUERY_KEY(2026, "cat-1"));
    expect(REPORTS_QUERY_KEY(2026, "cat-1")).not.toEqual(REPORTS_QUERY_KEY(2026, "cat-1,cat-2"));
  });

  it("el primer elemento siempre es 'reports'", () => {
    expect(REPORTS_QUERY_KEY(2024, null)[0]).toBe("reports");
  });

  it("el segundo elemento es el año", () => {
    expect(REPORTS_QUERY_KEY(2025, null)[1]).toBe(2025);
  });

  it("el tercer elemento es la clave de categorías", () => {
    expect(REPORTS_QUERY_KEY(2026, "abc")[2]).toBe("abc");
    expect(REPORTS_QUERY_KEY(2026, null)[2]).toBeNull();
  });
});

// ─── Tests useReports ─────────────────────────────────────────────────────────

describe("useReports", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("llama a GET /movements/reports?year=2026 (sin filtro, categoryIds=null)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockApiGet).toHaveBeenCalledWith("/movements/reports?year=2026");
  });

  it("incluye categories= en la URL cuando hay filtro", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, ["cat-1", "cat-2"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // La URL debe contener categories= con los ids ordenados
    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("year=2026");
    expect(callUrl).toContain("categories=cat-1,cat-2");
  });

  it("NO incluye categories= cuando categoryIds es null (= todas)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("categories=");
  });

  it("ordena los categoryIds antes de serializarlos (key estable)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    // Pasar en orden distinto → la URL debe tener los ids ordenados
    const { result } = renderHook(
      () => useReports(2026, ["cat-2", "cat-1"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("categories=cat-1,cat-2");
  });

  it("expone los datos tras la carga exitosa", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockReportsResponse);
    expect(result.current.data?.year).toBe(2026);
    expect(result.current.data?.months).toHaveLength(12);
    expect(result.current.data?.earliestYear).toBe(2025);
  });

  it("months siempre tiene 12 entradas", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.months).toHaveLength(12);
  });

  it("monthlyExpenseCents de cada categoría tiene 12 valores", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    result.current.data!.categories.forEach((cat) => {
      expect(cat.monthlyExpenseCents).toHaveLength(12);
    });
  });

  it("isLoading es true durante la carga", () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("isError es true cuando la API falla", async () => {
    mockApiGet.mockRejectedValue(new ApiError("Server Error", 500));

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("earliestYear es null cuando no hay movimientos", async () => {
    mockApiGet.mockResolvedValue(mockEmptyReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.earliestYear).toBeNull();
    expect(result.current.data!.categories).toHaveLength(0);
  });

  it("no dispara la query si isAuthenticated es false", () => {
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: undefined,
      isAuthenticated: false,
    });

    renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("earliestYear NO es afectado por el filtro de categorías", async () => {
    // El backend siempre devuelve earliestYear independiente del filtro;
    // el frontend simplemente lo expone tal cual.
    const filteredResponse: ReportsMovementsResponse = {
      ...mockReportsResponse,
      categories: [mockReportsResponse.categories[0]!],
      earliestYear: 2025, // No cambia aunque filtre categorías
    };
    mockApiGet.mockResolvedValue(filteredResponse);

    const { result } = renderHook(() => useReports(2026, ["cat-1"]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.earliestYear).toBe(2025);
  });

  it("invariante: suma de monthlyExpenseCents[i] == months[i].expenseCents", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const { months, categories } = result.current.data!;
    months.forEach((month, i) => {
      const sum = categories.reduce(
        (acc, cat) => acc + (cat.monthlyExpenseCents[i] ?? 0),
        0
      );
      expect(sum).toBe(month.expenseCents);
    });
  });
});
