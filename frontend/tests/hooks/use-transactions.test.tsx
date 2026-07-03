/**
 * Tests del hook useTransactions.
 * Verifica: crear (éxito, error 400, error servidor),
 * editar (éxito, 404, error), eliminar (éxito, 404, error).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTransactions } from "@/hooks/use-transactions";
import { ApiError } from "@/types/api";
import type { Transaction } from "@/types/transaction";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Transacción de ejemplo
const mockTransaction: Transaction = {
  id: "tx-1",
  userId: "user-1",
  categoryId: "cat-1",
  type: "EXPENSE",
  amountCents: 1550,
  description: "Almuerzo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  currency: "ARS",
  exchangeRate: 1,
  createdAt: "2026-06-17T17:30:00.000Z",
  updatedAt: "2026-06-17T17:30:00.000Z",
  category: {
    id: "cat-1",
    name: "Alimentación",
    color: "#FF5733",
    scope: "BOTH",
  },
  paymentMethodId: null,
  paymentMethod: null,
  autoDebit: null,
};

// ─── Wrapper con QueryClient ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useTransactions", () => {
  const mockApiGet = vi.fn();
  const mockApiPost = vi.fn();
  const mockApiPatch = vi.fn();
  const mockApiDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: mockApiPost,
        patch: mockApiPatch,
        delete: mockApiDelete,
        put: vi.fn(),
      },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  // ─── createTransaction ───────────────────────────────────────────────────────

  describe("createTransaction", () => {
    it("éxito: devuelve success=true con la transacción creada", async () => {
      mockApiPost.mockResolvedValue(mockTransaction);

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createTransaction>>;

      await act(async () => {
        createResult = await result.current.createTransaction({
          type: "EXPENSE",
          amountCents: 1550,
          categoryId: "cat-1",
          occurredAt: "2026-06-17T17:30:00.000Z",
          timezone: "America/Argentina/Buenos_Aires",
          description: "Almuerzo",
        });
      });

      expect(createResult!.success).toBe(true);
      expect(createResult!.transaction).toEqual(mockTransaction);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 1550,
          categoryId: "cat-1",
        }),
      );
    });

    it("error 400: devuelve error con el mensaje del backend", async () => {
      mockApiPost.mockRejectedValue(
        new ApiError("Categoría no compatible con el tipo de movimiento", 400),
      );

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createTransaction>>;

      await act(async () => {
        createResult = await result.current.createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-income-only",
          occurredAt: "2026-06-17T17:30:00.000Z",
          timezone: "America/Argentina/Buenos_Aires",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toBe("Categoría no compatible con el tipo de movimiento");
    });

    it("error de servidor (500): devuelve mensaje genérico", async () => {
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createTransaction>>;

      await act(async () => {
        createResult = await result.current.createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-1",
          occurredAt: "2026-06-17T17:30:00.000Z",
          timezone: "America/Argentina/Buenos_Aires",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toMatch(/error/i);
    });
  });

  // ─── updateTransaction ───────────────────────────────────────────────────────

  describe("updateTransaction", () => {
    it("éxito: devuelve success=true con la transacción actualizada", async () => {
      const updated = { ...mockTransaction, amountCents: 2000 };
      mockApiPatch.mockResolvedValue(updated);

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateTransaction>>;

      await act(async () => {
        updateResult = await result.current.updateTransaction("tx-1", { amountCents: 2000 });
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.transaction?.amountCents).toBe(2000);
      expect(mockApiPatch).toHaveBeenCalledWith("/transactions/tx-1", { amountCents: 2000 });
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiPatch.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateTransaction>>;

      await act(async () => {
        updateResult = await result.current.updateTransaction("tx-inexistente", {
          amountCents: 1000,
        });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── deleteTransaction ───────────────────────────────────────────────────────

  describe("deleteTransaction", () => {
    it("éxito: devuelve success=true y llama a DELETE /transactions/:id", async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTransaction>>;

      await act(async () => {
        deleteResult = await result.current.deleteTransaction("tx-1", "2026-06");
      });

      expect(deleteResult!.success).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith("/transactions/tx-1");
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTransaction>>;

      await act(async () => {
        deleteResult = await result.current.deleteTransaction("tx-inexistente", "2026-06");
      });

      expect(deleteResult!.success).toBe(false);
      expect(deleteResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── skipTransaction (P3) ────────────────────────────────────────────────────

  describe("skipTransaction", () => {
    it("éxito: llama POST /transactions/:id/skip SIN body y devuelve skipped", async () => {
      mockApiPost.mockResolvedValue({ skipped: true });

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let skipResult: Awaited<ReturnType<typeof result.current.skipTransaction>>;

      await act(async () => {
        skipResult = await result.current.skipTransaction("tx-1", "2026-06");
      });

      expect(skipResult!.success).toBe(true);
      expect(skipResult!.skipped).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith("/transactions/tx-1/skip", undefined);
    });

    it("toggle: la segunda llamada devuelve skipped=false (des-anular)", async () => {
      mockApiPost.mockResolvedValue({ skipped: false });

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let skipResult: Awaited<ReturnType<typeof result.current.skipTransaction>>;

      await act(async () => {
        skipResult = await result.current.skipTransaction("tx-1", "2026-06");
      });

      expect(skipResult!.skipped).toBe(false);
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiPost.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let skipResult: Awaited<ReturnType<typeof result.current.skipTransaction>>;

      await act(async () => {
        skipResult = await result.current.skipTransaction("tx-inexistente", "2026-06");
      });

      expect(skipResult!.success).toBe(false);
      expect(skipResult!.error).toMatch(/no existe|eliminado/i);
    });

    it("error de servidor (500): devuelve mensaje genérico", async () => {
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      let skipResult: Awaited<ReturnType<typeof result.current.skipTransaction>>;

      await act(async () => {
        skipResult = await result.current.skipTransaction("tx-1", "2026-06");
      });

      expect(skipResult!.success).toBe(false);
      expect(skipResult!.error).toMatch(/error/i);
    });
  });

  // ─── Estados de carga ────────────────────────────────────────────────────────

  describe("estados de carga", () => {
    it("isCreating arranca en false antes de la mutación", () => {
      mockApiPost.mockReturnValue(new Promise(() => {})); // nunca resuelve

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      expect(result.current.isCreating).toBe(false);
    });

    it("isCreating pasa a true mientras se ejecuta la mutación", async () => {
      mockApiPost.mockReturnValue(new Promise(() => {})); // nunca resuelve (simula pendiente)

      const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

      act(() => {
        void result.current.createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-1",
          occurredAt: "2026-06-17T17:30:00.000Z",
          timezone: "America/Argentina/Buenos_Aires",
        });
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
      });
    });
  });
});

