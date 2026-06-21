/**
 * Tests del hook useReferenceRate (Fase 1.2.4).
 *
 * Verifica:
 * - referenceRateQueryKey varía por mes Y moneda
 * - No dispara query cuando currency === defaultCurrency (shouldFetch=false)
 * - No dispara query cuando isAuthenticated=false
 * - Dispara query cuando currency !== defaultCurrency y está autenticado
 * - Retorna el exchangeRate cuando el backend lo provee
 * - Retorna referenceRate=null cuando el backend retorna exchangeRate: null
 * - isLoading=false cuando shouldFetch=false (no carga indefinidamente)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReferenceRate, referenceRateQueryKey } from "@/hooks/use-reference-rate";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockReferenceRateData = {
  currency: "USD" as const,
  defaultCurrency: "ARS" as const,
  yearMonth: "2026-06",
  exchangeRate: 1250.5,
};

const mockReferenceRateNull = {
  currency: "USD" as const,
  defaultCurrency: "ARS" as const,
  yearMonth: "2026-06",
  exchangeRate: null,
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

  return { Wrapper, queryClient };
}

// ─── Tests referenceRateQueryKey ─────────────────────────────────────────────

describe("referenceRateQueryKey", () => {
  it("incluye el mes y la moneda en la key", () => {
    expect(referenceRateQueryKey("2026-06", "USD")).toEqual(["reference-rate", "2026-06", "USD"]);
  });

  it("varía al cambiar el mes", () => {
    const k1 = referenceRateQueryKey("2026-06", "USD");
    const k2 = referenceRateQueryKey("2026-07", "USD");
    expect(k1).not.toEqual(k2);
  });

  it("varía al cambiar la moneda", () => {
    const k1 = referenceRateQueryKey("2026-06", "USD");
    const k2 = referenceRateQueryKey("2026-06", "EUR");
    expect(k1).not.toEqual(k2);
  });
});

// ─── Tests useReferenceRate ───────────────────────────────────────────────────

describe("useReferenceRate", () => {
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

  it("NO dispara la query cuando currency === defaultCurrency", () => {
    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "ARS",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    // shouldFetch=false → la query no debe haberse disparado
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("NO dispara la query cuando isAuthenticated=false", () => {
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

    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "USD",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("isLoading=false cuando shouldFetch=false (no queda cargando)", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "ARS",
          defaultCurrency: "ARS", // misma → shouldFetch=false
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.isLoading).toBe(false);
  });

  it("dispara query cuando currency !== defaultCurrency y está autenticado", async () => {
    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "USD",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/settings/reference-rate?month=2026-06&currency=USD",
      );
    });
  });

  it("retorna el exchangeRate cuando el backend lo provee", async () => {
    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "USD",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.referenceRate).toBe(1250.5);
  });

  it("retorna referenceRate=null cuando el backend retorna exchangeRate: null (mes sin dato)", async () => {
    mockApiGet.mockResolvedValue(mockReferenceRateNull);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency: "USD",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.referenceRate).toBeNull();
  });

  it("re-fetcha si cambia el mes (key varía por mes)", async () => {
    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    let month = "2026-06";

    const { rerender } = renderHook(
      () =>
        useReferenceRate({
          month,
          currency: "USD",
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/settings/reference-rate?month=2026-06&currency=USD",
      );
    });

    month = "2026-07";
    rerender();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/settings/reference-rate?month=2026-07&currency=USD",
      );
    });
  });

  it("re-fetcha si cambia la moneda (key varía por moneda)", async () => {
    mockApiGet.mockResolvedValue(mockReferenceRateData);
    const { Wrapper } = createWrapper();
    let currency: "USD" | "EUR" = "USD";

    const { rerender } = renderHook(
      () =>
        useReferenceRate({
          month: "2026-06",
          currency,
          defaultCurrency: "ARS",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/settings/reference-rate?month=2026-06&currency=USD",
      );
    });

    currency = "EUR";
    rerender();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/settings/reference-rate?month=2026-06&currency=EUR",
      );
    });
  });
});
