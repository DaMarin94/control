/**
 * Tests del hook useInstallments.
 * Verifica: crear (éxito, error 400, error servidor),
 * editar (éxito, 404, error), eliminar (éxito, 404, error).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useInstallments } from "@/hooks/use-installments";
import { ApiError } from "@/types/api";
import type { InstallmentGroup } from "@/types/installment";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Grupo de cuotas de ejemplo
const mockInstallment: InstallmentGroup = {
  id: "inst-1",
  userId: "user-1",
  categoryId: "cat-1",
  type: "EXPENSE",
  amountCents: 50000,
  totalInstallments: 12,
  startMonth: "2026-01",
  description: "Notebook",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  category: {
    id: "cat-1",
    name: "Tecnología",
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

describe("useInstallments", () => {
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

  // ─── createInstallment ───────────────────────────────────────────────────────

  describe("createInstallment", () => {
    it("éxito: devuelve success=true con el grupo creado", async () => {
      mockApiPost.mockResolvedValue(mockInstallment);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createInstallment>>;

      await act(async () => {
        createResult = await result.current.createInstallment({
          type: "EXPENSE",
          amountCents: 50000,
          totalInstallments: 12,
          categoryId: "cat-1",
          startMonth: "2026-01",
          description: "Notebook",
        });
      });

      expect(createResult!.success).toBe(true);
      expect(createResult!.installment).toEqual(mockInstallment);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/installments",
        expect.objectContaining({
          type: "EXPENSE",
          amountCents: 50000,
          totalInstallments: 12,
          categoryId: "cat-1",
          startMonth: "2026-01",
        }),
      );
    });

    it("siempre envía type='EXPENSE' (cuotas solo Gasto en v1)", async () => {
      mockApiPost.mockResolvedValue(mockInstallment);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.createInstallment({
          type: "EXPENSE",
          amountCents: 10000,
          totalInstallments: 3,
          categoryId: "cat-1",
          startMonth: "2026-06",
        });
      });

      expect(mockApiPost).toHaveBeenCalledWith(
        "/installments",
        expect.objectContaining({ type: "EXPENSE" }),
      );
    });

    it("error 400: devuelve error con el mensaje del backend", async () => {
      mockApiPost.mockRejectedValue(
        new ApiError("Categoría no compatible con el tipo de movimiento", 400),
      );

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createInstallment>>;

      await act(async () => {
        createResult = await result.current.createInstallment({
          type: "EXPENSE",
          amountCents: 1000,
          totalInstallments: 6,
          categoryId: "cat-income-only",
          startMonth: "2026-06",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toBe("Categoría no compatible con el tipo de movimiento");
    });

    it("error de servidor (500): devuelve mensaje genérico", async () => {
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createInstallment>>;

      await act(async () => {
        createResult = await result.current.createInstallment({
          type: "EXPENSE",
          amountCents: 1000,
          totalInstallments: 3,
          categoryId: "cat-1",
          startMonth: "2026-06",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toMatch(/error/i);
    });
  });

  // ─── updateInstallment ───────────────────────────────────────────────────────

  describe("updateInstallment", () => {
    it("éxito: devuelve success=true con el grupo actualizado", async () => {
      const updated = { ...mockInstallment, amountCents: 60000 };
      mockApiPatch.mockResolvedValue(updated);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateInstallment>>;

      await act(async () => {
        updateResult = await result.current.updateInstallment("inst-1", {
          amountCents: 60000,
        });
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.installment?.amountCents).toBe(60000);
      expect(mockApiPatch).toHaveBeenCalledWith("/installments/inst-1", {
        amountCents: 60000,
      });
    });

    it("NO envía type en el body de PATCH (type no es editable)", async () => {
      mockApiPatch.mockResolvedValue(mockInstallment);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.updateInstallment("inst-1", {
          amountCents: 60000,
          totalInstallments: 6,
          startMonth: "2026-02",
        });
      });

      // El body no debe incluir type
      const callBody = mockApiPatch.mock.calls[0][1] as Record<string, unknown>;
      expect(callBody).not.toHaveProperty("type");
    });

    it("description: null para limpiar el campo", async () => {
      mockApiPatch.mockResolvedValue({ ...mockInstallment, description: null });

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.updateInstallment("inst-1", {
          description: null,
        });
      });

      expect(mockApiPatch).toHaveBeenCalledWith(
        "/installments/inst-1",
        expect.objectContaining({ description: null }),
      );
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiPatch.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateInstallment>>;

      await act(async () => {
        updateResult = await result.current.updateInstallment("inst-inexistente", {
          amountCents: 1000,
        });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── deleteInstallment ───────────────────────────────────────────────────────

  describe("deleteInstallment", () => {
    it("éxito: llama DELETE /installments/:id sin query params", async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteInstallment>>;

      await act(async () => {
        deleteResult = await result.current.deleteInstallment("inst-1");
      });

      expect(deleteResult!.success).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith("/installments/inst-1");
    });

    it("DELETE no incluye query params (eliminación total sin condiciones)", async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.deleteInstallment("inst-1");
      });

      // El path no debe incluir "?" (sin query params)
      const path = mockApiDelete.mock.calls[0][0] as string;
      expect(path).not.toContain("?");
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteInstallment>>;

      await act(async () => {
        deleteResult = await result.current.deleteInstallment("inst-inexistente");
      });

      expect(deleteResult!.success).toBe(false);
      expect(deleteResult!.error).toMatch(/no existe|eliminado/i);
    });
  });

  // ─── Estado de carga ─────────────────────────────────────────────────────────

  describe("Estado de carga", () => {
    it("isCreating arranca en false antes de la mutación", () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      expect(result.current.isCreating).toBe(false);
    });

    it("isCreating pasa a true mientras se ejecuta la mutación", async () => {
      mockApiPost.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useInstallments(), { wrapper: createWrapper() });

      act(() => {
        void result.current.createInstallment({
          type: "EXPENSE",
          amountCents: 1000,
          totalInstallments: 3,
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
