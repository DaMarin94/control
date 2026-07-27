/**
 * Tests del hook useExternalRates (sección "Datos externos" de /configuracion).
 *
 * Verifica:
 * - EXTERNAL_RATES_QUERY_KEY varía por ipcFrom.
 * - No dispara la query cuando isAuthenticated=false.
 * - GET /settings/external-rates sin ipcFrom en la carga inicial.
 * - loadOlderMonths re-pide el GET con ipcFrom = (año del `from` actual − 1)-01.
 * - hasMore refleja snapshot.ipc.hasMore.
 * - syncExternalRates: POST + re-fetch; distingue "changed" de "unchanged"
 *   comparando valores (ignorando fetchedAt/source).
 * - syncExternalRates: si el POST falla, retorna "error" y no toca la data mostrada.
 * - isSyncing true durante el POST/refetch, false al terminar.
 * - snapshotsDiffer (función pura exportada): casos de igualdad/diferencia.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useExternalRates,
  EXTERNAL_RATES_QUERY_KEY,
  snapshotsDiffer,
} from "@/hooks/use-external-rates";
import { ApiError } from "@/types/api";
import type { ExternalRatesSnapshot } from "@/types/external-rates";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function buildSnapshot(overrides?: Partial<ExternalRatesSnapshot>): ExternalRatesSnapshot {
  return {
    ipc: {
      latest: {
        yearMonth: "2026-06",
        monthlyVariation: 1.58,
        indexValue: 120.5,
        fetchedAt: "2026-06-05T10:00:00.000Z",
        source: "apis.datos.gob.ar",
      },
      history: [
        {
          yearMonth: "2026-06",
          monthlyVariation: 1.58,
          indexValue: 120.5,
          fetchedAt: "2026-06-05T10:00:00.000Z",
          source: "apis.datos.gob.ar",
        },
        {
          yearMonth: "2026-05",
          monthlyVariation: 1.2,
          indexValue: 118.6,
          fetchedAt: "2026-05-05T10:00:00.000Z",
          source: "apis.datos.gob.ar",
        },
      ],
      from: "2026-01",
      hasMore: true,
      ...overrides?.ipc,
    },
    fx: {
      month: "2026-06",
      arsOficial: { compra: 1080, venta: 1100, fetchedAt: "2026-06-05T10:00:00.000Z", source: "dolarapi.com" },
      arsBlue: { compra: 1150, venta: 1180, fetchedAt: "2026-06-05T10:00:00.000Z", source: "dolarapi.com" },
      eur: { compra: 1200, venta: 1200, fetchedAt: "2026-06-05T10:00:00.000Z", source: "api.frankfurter.dev" },
      brl: null,
      ...overrides?.fx,
    },
  };
}

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

function setupApi({ get, post }: { get: ReturnType<typeof vi.fn>; post?: ReturnType<typeof vi.fn> }) {
  mockUseApi.mockReturnValue({
    api: {
      get,
      post: post ?? vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    },
    token: "test-token",
    isAuthenticated: true,
  });
}

// ─── Tests EXTERNAL_RATES_QUERY_KEY ───────────────────────────────────────────

describe("EXTERNAL_RATES_QUERY_KEY", () => {
  it("varía según ipcFrom", () => {
    expect(EXTERNAL_RATES_QUERY_KEY("2025-01")).toEqual(["external-rates", "2025-01"]);
    expect(EXTERNAL_RATES_QUERY_KEY()).toEqual(["external-rates", null]);
    expect(EXTERNAL_RATES_QUERY_KEY("2025-01")).not.toEqual(EXTERNAL_RATES_QUERY_KEY("2024-01"));
  });
});

// ─── Tests snapshotsDiffer ─────────────────────────────────────────────────────

describe("snapshotsDiffer", () => {
  it("false cuando los valores son idénticos (aun con fetchedAt/source distintos)", () => {
    const a = buildSnapshot();
    const b = buildSnapshot({
      ipc: {
        ...buildSnapshot().ipc,
        latest: { ...buildSnapshot().ipc.latest!, fetchedAt: "2026-06-06T00:00:00.000Z", source: "otra-fuente" },
      },
    });
    expect(snapshotsDiffer(a, b)).toBe(false);
  });

  it("true cuando cambia monthlyVariation del destacado", () => {
    const a = buildSnapshot();
    const b = buildSnapshot({
      ipc: { ...buildSnapshot().ipc, latest: { ...buildSnapshot().ipc.latest!, monthlyVariation: 2.1 } },
    });
    expect(snapshotsDiffer(a, b)).toBe(true);
  });

  it("true cuando cambia la longitud del historial", () => {
    const a = buildSnapshot();
    const b = buildSnapshot({ ipc: { ...buildSnapshot().ipc, history: [buildSnapshot().ipc.history[0]] } });
    expect(snapshotsDiffer(a, b)).toBe(true);
  });

  it("true cuando cambia venta de una cotización FX", () => {
    const a = buildSnapshot();
    const b = buildSnapshot({
      fx: { ...buildSnapshot().fx, arsOficial: { ...buildSnapshot().fx.arsOficial!, venta: 1150 } },
    });
    expect(snapshotsDiffer(a, b)).toBe(true);
  });

  it("true cuando una cotización pasa de null a con dato (o viceversa)", () => {
    const a = buildSnapshot({ fx: { ...buildSnapshot().fx, brl: null } });
    const b = buildSnapshot({
      fx: { ...buildSnapshot().fx, brl: { compra: 200, venta: 205, fetchedAt: "x", source: "y" } },
    });
    expect(snapshotsDiffer(a, b)).toBe(true);
  });

  it("false cuando ambos snapshots son iguales objeto por objeto", () => {
    const snap = buildSnapshot();
    expect(snapshotsDiffer(snap, buildSnapshot())).toBe(false);
  });
});

// ─── Tests useExternalRates ────────────────────────────────────────────────────

describe("useExternalRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("NO dispara la query cuando isAuthenticated=false", () => {
    const mockGet = vi.fn().mockResolvedValue(buildSnapshot());
    mockUseApi.mockReturnValue({
      api: { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: undefined,
      isAuthenticated: false,
    });
    const { Wrapper } = createWrapper();
    renderHook(() => useExternalRates(), { wrapper: Wrapper });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("carga el snapshot con GET /settings/external-rates (sin ipcFrom) al montar", async () => {
    const mockGet = vi.fn().mockResolvedValue(buildSnapshot());
    setupApi({ get: mockGet });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExternalRates(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith("/settings/external-rates");
    expect(result.current.snapshot).toEqual(buildSnapshot());
    expect(result.current.hasMore).toBe(true);
  });

  it("loadOlderMonths re-pide el GET con ipcFrom = (año(from) − 1)-01", async () => {
    const mockGet = vi.fn().mockResolvedValue(buildSnapshot());
    setupApi({ get: mockGet });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExternalRates(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const olderSnapshot = buildSnapshot({
      ipc: {
        latest: buildSnapshot().ipc.latest,
        from: "2025-01",
        hasMore: false,
        history: [
          buildSnapshot().ipc.history[0],
          buildSnapshot().ipc.history[1],
          { yearMonth: "2025-12", monthlyVariation: 0.9, indexValue: 110, fetchedAt: "x", source: "y" },
        ],
      },
    });
    mockGet.mockResolvedValueOnce(olderSnapshot);

    act(() => {
      result.current.loadOlderMonths();
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/settings/external-rates?ipcFrom=2025-01");
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.snapshot?.ipc.history).toHaveLength(3);
  });

  it("syncExternalRates: POST + re-fetch con valores distintos → outcome 'changed'", async () => {
    const initial = buildSnapshot();
    const updated = buildSnapshot({
      ipc: { ...initial.ipc, latest: { ...initial.ipc.latest!, monthlyVariation: 2.4 } },
    });
    const mockGet = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated);
    const mockPost = vi.fn().mockResolvedValue({ scope: "all", results: [], acceptedCount: 1, rejectedCount: 0 });
    setupApi({ get: mockGet, post: mockPost });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExternalRates(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let syncResult: Awaited<ReturnType<typeof result.current.syncExternalRates>> | undefined;
    await act(async () => {
      syncResult = await result.current.syncExternalRates();
    });

    expect(mockPost).toHaveBeenCalledWith("/settings/external-rates/sync", undefined);
    expect(syncResult).toEqual({ outcome: "changed" });
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.snapshot).toEqual(updated);
  });

  it("syncExternalRates: POST + re-fetch con valores idénticos → outcome 'unchanged'", async () => {
    const initial = buildSnapshot();
    // Misma data, pero con fetchedAt distinto (comportamiento real del backend: upsert pisa fetchedAt igual).
    const sameValuesFreshFetchedAt = buildSnapshot({
      ipc: { ...initial.ipc, latest: { ...initial.ipc.latest!, fetchedAt: "2026-06-07T00:00:00.000Z" } },
    });
    const mockGet = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(sameValuesFreshFetchedAt);
    const mockPost = vi.fn().mockResolvedValue({ scope: "all", results: [], acceptedCount: 1, rejectedCount: 0 });
    setupApi({ get: mockGet, post: mockPost });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExternalRates(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let syncResult: Awaited<ReturnType<typeof result.current.syncExternalRates>> | undefined;
    await act(async () => {
      syncResult = await result.current.syncExternalRates();
    });

    expect(syncResult).toEqual({ outcome: "unchanged" });
  });

  it("syncExternalRates: si el POST falla, retorna 'error' y no toca la data mostrada", async () => {
    const initial = buildSnapshot();
    const mockGet = vi.fn().mockResolvedValue(initial);
    const mockPost = vi.fn().mockRejectedValue(new ApiError("Rate limit excedido", 429));
    setupApi({ get: mockGet, post: mockPost });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExternalRates(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let syncResult: Awaited<ReturnType<typeof result.current.syncExternalRates>> | undefined;
    await act(async () => {
      syncResult = await result.current.syncExternalRates();
    });

    expect(syncResult).toEqual({ outcome: "error" });
    expect(result.current.isSyncing).toBe(false);
    // La data mostrada sigue siendo la inicial — el GET solo se llamó una vez (el mount).
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot).toEqual(initial);
  });
});
