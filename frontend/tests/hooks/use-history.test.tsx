/**
 * Tests del hook useHistory / useUndoHistory.
 * Verifica: GET /history (query gate-ada por isAuthenticated), POST /history/:id/undo
 * (éxito con invalidación de ["history"], ["movements"], ["reports"]; 404; error de servidor).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useHistory, useUndoHistory, HISTORY_QUERY_KEY } from "@/hooks/use-history";
import { ApiError } from "@/types/api";
import type { HistoryEntryResponseDto } from "@/types/history";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

const mockEntry: HistoryEntryResponseDto = {
  id: "hist-1",
  targetKind: "UNICO",
  targetId: "tx-1",
  action: "EDIT",
  createdAt: "2026-06-02T17:30:00.000Z",
  description: "Supermercado",
  category: { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" },
  type: "EXPENSE",
  amount: { amountCents: 150000, currency: "ARS", type: "EXPENSE" },
  isCalculated: false,
  changes: [],
  canUndo: true,
  blockingCount: 0,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useHistory", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("carga la lista desde GET /history", async () => {
    mockApiGet.mockResolvedValue([mockEntry]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([mockEntry]);
    });
    expect(mockApiGet).toHaveBeenCalledWith("/history");
  });

  it("no dispara la query si no está autenticado (evita 401 espurio)", () => {
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: undefined,
      isAuthenticated: false,
    });
    const { Wrapper } = createWrapper();

    renderHook(() => useHistory(), { wrapper: Wrapper });

    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useUndoHistory", () => {
  const mockApiPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: vi.fn(), post: mockApiPost, patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("éxito: llama POST /history/:id/undo sin body y devuelve success=true", async () => {
    mockApiPost.mockResolvedValue({ undone: true });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUndoHistory(), { wrapper: Wrapper });

    let undoResult: Awaited<ReturnType<typeof result.current.undo>>;
    await act(async () => {
      undoResult = await result.current.undo("hist-1");
    });

    expect(undoResult!.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith("/history/hist-1/undo", undefined);
  });

  it("éxito: invalida history, movements y reports (deshacer muta movimientos)", async () => {
    mockApiPost.mockResolvedValue({ undone: true });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUndoHistory(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.undo("hist-1");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(HISTORY_QUERY_KEY);
    expect(invalidatedKeys).toContainEqual(["movements"]);
    expect(invalidatedKeys).toContainEqual(["reports"]);
  });

  it("404: devuelve error descriptivo (entrada purgada o de otro usuario)", async () => {
    mockApiPost.mockRejectedValue(new ApiError("Not found", 404));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUndoHistory(), { wrapper: Wrapper });

    let undoResult: Awaited<ReturnType<typeof result.current.undo>>;
    await act(async () => {
      undoResult = await result.current.undo("hist-inexistente");
    });

    expect(undoResult!.success).toBe(false);
    expect(undoResult!.error).toMatch(/no está disponible/i);
  });

  it("error de servidor (500): devuelve mensaje genérico y el modal puede reintentar", async () => {
    mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUndoHistory(), { wrapper: Wrapper });

    let undoResult: Awaited<ReturnType<typeof result.current.undo>>;
    await act(async () => {
      undoResult = await result.current.undo("hist-1");
    });

    expect(undoResult!.success).toBe(false);
    expect(undoResult!.error).toMatch(/no se pudo deshacer/i);
  });

  it("isUndoing pasa a true mientras la mutación está pendiente", async () => {
    mockApiPost.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUndoHistory(), { wrapper: Wrapper });

    act(() => {
      void result.current.undo("hist-1");
    });

    await waitFor(() => {
      expect(result.current.isUndoing).toBe(true);
    });
  });
});
