/**
 * Tests del hook useAnnual.
 *
 * Verifica:
 * - ANNUAL_QUERY_KEY genera la query key correcta (varía por año)
 * - useAnnual llama a GET /movements/annual?year=YYYY
 * - Estados isLoading/data/isError
 * - enabled: isAuthenticated (no dispara sin autenticación)
 * - El contrato de la respuesta (months × 12, categories con monthlyExpenseCents × 12)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAnnual, ANNUAL_QUERY_KEY } from "@/hooks/use-annual";
import { ApiError } from "@/types/api";
import type { AnnualMovementsResponse } from "@/types/annual";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockAnnualResponse: AnnualMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: i < 6 ? 50000 : 0,  // Solo primeros 6 meses tienen ingresos
    expenseCents: i < 6 ? 20000 : 0, // Solo primeros 6 meses tienen gastos
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

const mockEmptyAnnualResponse: AnnualMovementsResponse = {
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

// ─── Tests ANNUAL_QUERY_KEY ───────────────────────────────────────────────────

describe("ANNUAL_QUERY_KEY", () => {
  it("genera la query key correcta para un año", () => {
    expect(ANNUAL_QUERY_KEY(2026)).toEqual(["annual", 2026]);
  });

  it("query keys de años distintos son distintas", () => {
    expect(ANNUAL_QUERY_KEY(2026)).not.toEqual(ANNUAL_QUERY_KEY(2025));
  });

  it("el primer elemento es siempre 'annual'", () => {
    expect(ANNUAL_QUERY_KEY(2024)[0]).toBe("annual");
  });

  it("el segundo elemento es el año", () => {
    expect(ANNUAL_QUERY_KEY(2025)[1]).toBe(2025);
  });
});

// ─── Tests useAnnual ─────────────────────────────────────────────────────────

describe("useAnnual", () => {
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

  it("llama a GET /movements/annual?year=2026", async () => {
    mockApiGet.mockResolvedValue(mockAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockApiGet).toHaveBeenCalledWith("/movements/annual?year=2026");
  });

  it("expone los datos tras la carga exitosa", async () => {
    mockApiGet.mockResolvedValue(mockAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockAnnualResponse);
    expect(result.current.data?.year).toBe(2026);
    expect(result.current.data?.months).toHaveLength(12);
    expect(result.current.data?.earliestYear).toBe(2025);
  });

  it("months siempre tiene 12 entradas", async () => {
    mockApiGet.mockResolvedValue(mockAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.months).toHaveLength(12);
  });

  it("monthlyExpenseCents de cada categoría tiene 12 valores", async () => {
    mockApiGet.mockResolvedValue(mockAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    result.current.data!.categories.forEach((cat) => {
      expect(cat.monthlyExpenseCents).toHaveLength(12);
    });
  });

  it("isLoading es true durante la carga", () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("isError es true cuando la API falla", async () => {
    mockApiGet.mockRejectedValue(new ApiError("Server Error", 500));

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("earliestYear es null cuando no hay movimientos", async () => {
    mockApiGet.mockResolvedValue(mockEmptyAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.earliestYear).toBeNull();
    expect(result.current.data!.categories).toHaveLength(0);
  });

  it("no dispara la query si isAuthenticated es false", () => {
    // Simular que no hay token (usuario no autenticado todavía)
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

    renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("invariante: suma de monthlyExpenseCents[i] == months[i].expenseCents", async () => {
    mockApiGet.mockResolvedValue(mockAnnualResponse);

    const { result } = renderHook(() => useAnnual(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const { months, categories } = result.current.data!;
    months.forEach((month, i) => {
      const sum = categories.reduce((acc, cat) => acc + (cat.monthlyExpenseCents[i] ?? 0), 0);
      expect(sum).toBe(month.expenseCents);
    });
  });
});
