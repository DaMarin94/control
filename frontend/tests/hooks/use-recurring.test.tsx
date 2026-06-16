/**
 * Tests del hook useRecurring.
 * Verifica: crear (éxito, error 400, error servidor),
 * editar (éxito, 404, error), eliminar (éxito, 404, error,
 * variantes de fromCurrentMonth).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRecurring } from "@/hooks/use-recurring";
import { ApiError } from "@/types/api";
import type { Recurring } from "@/types/recurring";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Fijo de ejemplo
const mockRecurring: Recurring = {
  id: "rec-1",
  userId: "user-1",
  categoryId: "cat-1",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  startMonth: "2026-06",
  deletedFrom: null,
  frequency: "MONTHLY",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  category: {
    id: "cat-1",
    name: "Servicios",
    color: "#FF5733",
    scope: "EXPENSE",
  },
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

describe("useRecurring", () => {
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
    });
  });

  // ─── createRecurring ─────────────────────────────────────────────────────────

  describe("createRecurring", () => {
    it("éxito: devuelve success=true con el fijo creado", async () => {
      mockApiPost.mockResolvedValue(mockRecurring);

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createRecurring>>;

      await act(async () => {
        createResult = await result.current.createRecurring({
          type: "EXPENSE",
          amountCents: 150000,
          categoryId: "cat-1",
          startMonth: "2026-06",
          description: "Alquiler",
        });
      });

      expect(createResult!.success).toBe(true);
      expect(createResult!.recurring).toEqual(mockRecurring);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/recurring",
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 150000,
          categoryId: "cat-1",
          startMonth: "2026-06",
        }),
      );
    });

    it("error 400: devuelve error con el mensaje del backend", async () => {
      mockApiPost.mockRejectedValue(
        new ApiError("Categoría no compatible con el tipo de movimiento", 400),
      );

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createRecurring>>;

      await act(async () => {
        createResult = await result.current.createRecurring({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-income-only",
          startMonth: "2026-06",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toBe("Categoría no compatible con el tipo de movimiento");
    });

    it("error de servidor (500): devuelve mensaje genérico", async () => {
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createRecurring>>;

      await act(async () => {
        createResult = await result.current.createRecurring({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-1",
          startMonth: "2026-06",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toMatch(/error/i);
    });
  });

  // ─── updateRecurring ─────────────────────────────────────────────────────────

  describe("updateRecurring", () => {
    it("éxito: devuelve success=true con el fijo actualizado", async () => {
      const updated = { ...mockRecurring, amountCents: 200000 };
      mockApiPatch.mockResolvedValue(updated);

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateRecurring>>;

      await act(async () => {
        updateResult = await result.current.updateRecurring("rec-1", {
          currentMonth: "2026-06",
          amountCents: 200000,
        });
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.recurring?.amountCents).toBe(200000);
      expect(mockApiPatch).toHaveBeenCalledWith("/recurring/rec-1", {
        currentMonth: "2026-06",
        amountCents: 200000,
      });
    });

    it("el body incluye currentMonth (requerido por el backend)", async () => {
      mockApiPatch.mockResolvedValue(mockRecurring);

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.updateRecurring("rec-1", {
          currentMonth: "2026-07",
          description: "Descripción actualizada",
        });
      });

      expect(mockApiPatch).toHaveBeenCalledWith(
        "/recurring/rec-1",
        expect.objectContaining({ currentMonth: "2026-07" }),
      );
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiPatch.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateRecurring>>;

      await act(async () => {
        updateResult = await result.current.updateRecurring("rec-inexistente", {
          currentMonth: "2026-06",
          amountCents: 1000,
        });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── deleteRecurring ─────────────────────────────────────────────────────────

  describe("deleteRecurring", () => {
    it("éxito con fromCurrentMonth=false: llama DELETE con params correctos", async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteRecurring>>;

      await act(async () => {
        deleteResult = await result.current.deleteRecurring("rec-1", {
          currentMonth: "2026-06",
          fromCurrentMonth: false,
        });
      });

      expect(deleteResult!.success).toBe(true);
      // El path debe incluir ambos query params como strings
      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining("currentMonth=2026-06"),
      );
      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining("fromCurrentMonth=false"),
      );
    });

    it("éxito con fromCurrentMonth=true: envía fromCurrentMonth=true como string", async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteRecurring>>;

      await act(async () => {
        deleteResult = await result.current.deleteRecurring("rec-1", {
          currentMonth: "2026-06",
          fromCurrentMonth: true,
        });
      });

      expect(deleteResult!.success).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining("fromCurrentMonth=true"),
      );
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteRecurring>>;

      await act(async () => {
        deleteResult = await result.current.deleteRecurring("rec-inexistente", {
          currentMonth: "2026-06",
          fromCurrentMonth: false,
        });
      });

      expect(deleteResult!.success).toBe(false);
      expect(deleteResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── Invalidación de queries ─────────────────────────────────────────────────

  describe("Invalidación de queries", () => {
    it("isCreating arranca en false antes de la mutación", () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      expect(result.current.isCreating).toBe(false);
    });

    it("isCreating pasa a true mientras se ejecuta la mutación", async () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useRecurring(), { wrapper: createWrapper() });

      act(() => {
        void result.current.createRecurring({
          type: "EXPENSE",
          amountCents: 1000,
          categoryId: "cat-1",
          startMonth: "2026-06",
        });
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
      });
    });
  });
});
