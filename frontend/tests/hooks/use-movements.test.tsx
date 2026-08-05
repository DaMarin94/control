/**
 * Tests del hook useMovements (Fase 1.1.6).
 *
 * Verifica:
 * - MOVEMENTS_QUERY_KEY genera la query key correcta (varía por mes y filtro)
 * - useMovements llama a GET /movements?month=YYYY-MM
 * - Filtro de 3 estados: null (omite param), [] (param vacío), lista (ids)
 * - Los estados isLoading/data/isError funcionan correctamente
 * - enabled: isAuthenticated (no dispara sin autenticación)
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
        frequency: null,
        startMonth: null,
        endMonth: null,
        skipped: false,
        category: {
          id: "cat-1",
          name: "Alimentación",
          color: "#FF5733",
          scope: "BOTH",
        },
        paymentMethod: null,
        autoDebit: null,
        calculated: null,
        hasCalculated: false,
        currency: "ARS" as const,
        exchangeRate: 1,
        convertedAmountCents: 15000,
        simulated: false,
        calculatedChildren: [],
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
  it("genera la query key correcta para un mes (sin filtro = null)", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06")).toEqual(["movements", "2026-06", null]);
  });

  it("genera la query key correcta con filtro vacío [] (ninguna)", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06", "")).toEqual(["movements", "2026-06", ""]);
  });

  it("genera la query key correcta con subconjunto de categorías", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06", "cat-1,cat-2")).toEqual([
      "movements",
      "2026-06",
      "cat-1,cat-2",
    ]);
  });

  it("query keys de meses distintos son distintas", () => {
    const key1 = MOVEMENTS_QUERY_KEY("2026-06");
    const key2 = MOVEMENTS_QUERY_KEY("2026-07");
    expect(key1).not.toEqual(key2);
  });

  it("null y [] (ninguna) producen query keys distintas (para que React Query refetche)", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06", null)).not.toEqual(
      MOVEMENTS_QUERY_KEY("2026-06", "")
    );
  });

  it("incluye el mes como segundo elemento", () => {
    const key = MOVEMENTS_QUERY_KEY("2025-12");
    expect(key[0]).toBe("movements");
    expect(key[1]).toBe("2025-12");
  });

  it("incluye el filtro como tercer elemento", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06", "cat-1")[2]).toBe("cat-1");
    expect(MOVEMENTS_QUERY_KEY("2026-06", null)[2]).toBeNull();
    expect(MOVEMENTS_QUERY_KEY("2026-06", "")[2]).toBe("");
  });

  it("sin `today` devuelve una key de 3 elementos (prefijo válido para invalidateQueries)", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06")).toHaveLength(3);
    expect(MOVEMENTS_QUERY_KEY("2026-06", "cat-1")).toHaveLength(3);
  });

  it("con `today` agrega un 4to elemento con la fecha", () => {
    expect(MOVEMENTS_QUERY_KEY("2026-06", null, "2026-07-31")).toEqual([
      "movements",
      "2026-06",
      null,
      "2026-07-31",
    ]);
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
      isAuthenticated: true,
    });
  });

  it("llama a GET /movements?month=YYYY-MM con el mes correcto (sin filtro) y today=YYYY-MM-DD", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/movements\?month=2026-06&today=\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("NO incluye categories= cuando categoryIds es null (= todas)", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06", null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("categories");
  });

  it("incluye &categories= vacío cuando categoryIds es [] (= ninguna)", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06", []), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toMatch(/^\/movements\?month=2026-06&categories=&today=\d{4}-\d{2}-\d{2}$/);
  });

  it("incluye &categories=id1,id2 cuando categoryIds es una lista", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06", ["cat-1", "cat-2"]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("categories=cat-1,cat-2");
  });

  it("ordena los categoryIds antes de serializarlos (key estable)", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const { result } = renderHook(() => useMovements("2026-06", ["cat-2", "cat-1"]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("categories=cat-1,cat-2");
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

  it("no realiza la query si isAuthenticated es false", () => {
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

    renderHook(() => useMovements("2026-06"), {
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

  it("manda el today con la fecha LOCAL (no la UTC) cerca de medianoche en UTC-3 (RN-028)", async () => {
    mockApiGet.mockResolvedValue(mockMonthMovements);

    const originalTZ = process.env.TZ;
    process.env.TZ = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano

    // Solo se fakea Date (no setTimeout/setInterval), así waitFor sigue funcionando.
    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-07-31T23:00:00 en Buenos Aires (UTC-3) = 2026-08-01T02:00:00Z.
    // El día UTC ya rodó a agosto; el día LOCAL del usuario todavía es 31 de julio.
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));

    try {
      const { result } = renderHook(() => useMovements("2026-07"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("today=2026-07-31");
      expect(callUrl).not.toContain("today=2026-08-01");
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTZ;
    }
  });
});
