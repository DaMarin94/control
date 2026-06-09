/**
 * Tests del hook useMovements.
 *
 * Verifica:
 * - MOVEMENTS_QUERY_KEY genera la query key correcta
 * - useMovements llama a GET /movements?month=YYYY-MM
 * - Los estados isLoading/data/isError funcionan correctamente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMovements, MOVEMENTS_QUERY_KEY } from "@/hooks/use-movements";
import { ApiError } from "@/types/api";
import type { MonthMovements } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Datos de ejemplo
const mockMonthMovements: MonthMovements = {
  month: "2026-06",
  totals: {
    expenseCents: 15000,
    incomeCents: 50000,
    balanceCents: 35000,
  },
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
        category: {
          id: "cat-1",
          name: "Alimentación",
          color: "#FF5733",
          scope: "BOTH",
        },
      },
    ],
    fijos: [],
    cuotas: [],
  },
};

// ─── Wrapper con QueryClient ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

// ─── Tests MOVEMENTS_QUERY_KEY ────────────────────────────────────────────────

describe("MOVEMENTS_QUERY_KEY", () => {
  it("genera la query key correcta para un mes", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06")).toEqual(["movements", "2026-06"]);
  });

  it("query keys de meses distintos son distintas", () => {
    const key1 = MOVEMENTS_QUERY_KEY("2026-06");
    const key2 = MOVEMENTS_QUERY_KEY("2026-07");
    expect(key1).not.toEqual(key2);
  });

  it("incluye el mes como segundo elemento", () => {
    const key = MOVEMENTS_QUERY_KEY("2025-12");
    expect(key[0]).toBe("movements");
    expect(key[1]).toBe("2025-12");
  });
});

// ─── Tests useMovements ───────────────────────────────────────────────────────

describe("useMovements", () => {
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
    });
  });

  it("llama a GET /movements?month=YYYY-MM con el mes correcto", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockApiGet).toHaveBeenCalledWith("/movements?month=2026-06");
  });

  it("expone los datos del mes tras la carga exitosa", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockMonthMovements);
    expect(result.current.data?.totals.expenseCents).toBe(15000);
    expect(result.current.data?.totals.incomeCents).toBe(50000);
    expect(result.current.data?.totals.balanceCents).toBe(35000);
    expect(result.current.data?.movements.unicos).toHaveLength(1);
  });

  it("isLoading es true durante la carga inicial", () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // nunca resuelve

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("isError es true cuando la API falla", async () => {
    mockApiGet.mockRejectedValue(new ApiError("Internal Server Error", 500));

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("no realiza la query si month está vacío", () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    renderHook(() => useMovements(""), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("las secciones fijos y cuotas vienen vacías en Fase 5", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.movements.fijos).toHaveLength(0);
    expect(result.current.data?.movements.cuotas).toHaveLength(0);
  });
});
