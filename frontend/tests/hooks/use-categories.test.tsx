/**
 * Tests del hook useCategories.
 * Verifica: crear (éxito, 409 activa, 409 reactivable, error servidor),
 * editar (éxito, 409 colisión), eliminar (éxito, error), reactivar (éxito, error).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCategories } from "@/hooks/use-categories";
import { ApiError } from "@/types/api";
import type { Category } from "@/types/category";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Categoría de ejemplo
const mockCategory: Category = {
  id: "cat-1",
  userId: "user-1",
  name: "Alimentación",
  scope: "BOTH",
  color: "#FF5733",
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 3,
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

describe("useCategories", () => {
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

  // ─── createCategory ─────────────────────────────────────────────────────────

  describe("createCategory", () => {
    it("éxito: devuelve success=true con la categoría creada", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockResolvedValue(mockCategory);

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createCategory>>;

      await act(async () => {
        createResult = await result.current.createCategory({
          name: "Alimentación",
          scope: "BOTH",
        });
      });

      expect(createResult!.success).toBe(true);
      expect(createResult!.category).toEqual(mockCategory);
      expect(mockApiPost).toHaveBeenCalledWith("/categories", {
        name: "Alimentación",
        scope: "BOTH",
      });
    });

    it("409 sin error.data: devuelve nameConflict=true (colisión con activa)", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(new ApiError("Ya existe una categoría activa con ese nombre", 409));

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createCategory>>;

      await act(async () => {
        createResult = await result.current.createCategory({ name: "Alimentación" });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.nameConflict).toBe(true);
      expect(createResult!.reactivable).toBeUndefined();
    });

    it("409 con error.data.reactivable=true: devuelve los datos para el prompt", async () => {
      mockApiGet.mockResolvedValue([]);

      const reactivableData = {
        reactivable: true,
        category: {
          id: "cat-deleted-1",
          name: "Alimentación",
          scope: "BOTH",
          color: "#FF5733",
        },
      };

      mockApiPost.mockRejectedValue(
        new ApiError("Ya existe una categoría eliminada reactivable", 409, {
          data: reactivableData,
        }),
      );

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createCategory>>;

      await act(async () => {
        createResult = await result.current.createCategory({ name: "Alimentación" });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.nameConflict).toBeUndefined();
      expect(createResult!.reactivable).toEqual(reactivableData.category);
      expect(createResult!.reactivable?.id).toBe("cat-deleted-1");
    });

    it("error de servidor (500): devuelve error genérico", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createCategory>>;

      await act(async () => {
        createResult = await result.current.createCategory({ name: "Test" });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toMatch(/error/i);
    });
  });

  // ─── updateCategory ─────────────────────────────────────────────────────────

  describe("updateCategory", () => {
    it("éxito: devuelve success=true con la categoría actualizada", async () => {
      mockApiGet.mockResolvedValue([mockCategory]);
      const updatedCategory = { ...mockCategory, name: "Comida" };
      mockApiPatch.mockResolvedValue(updatedCategory);

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateCategory>>;

      await act(async () => {
        updateResult = await result.current.updateCategory("cat-1", { name: "Comida" });
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.category?.name).toBe("Comida");
      expect(mockApiPatch).toHaveBeenCalledWith("/categories/cat-1", { name: "Comida" });
    });

    it("409: devuelve nameConflict=true", async () => {
      mockApiGet.mockResolvedValue([mockCategory]);
      mockApiPatch.mockRejectedValue(new ApiError("Nombre en uso", 409));

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updateCategory>>;

      await act(async () => {
        updateResult = await result.current.updateCategory("cat-1", { name: "Comida" });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.nameConflict).toBe(true);
    });
  });

  // ─── deleteCategory ─────────────────────────────────────────────────────────

  describe("deleteCategory", () => {
    it("éxito: devuelve success=true y llama a DELETE /categories/:id", async () => {
      mockApiGet.mockResolvedValue([mockCategory]);
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteCategory>>;

      await act(async () => {
        deleteResult = await result.current.deleteCategory("cat-1");
      });

      expect(deleteResult!.success).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith("/categories/cat-1");
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiGet.mockResolvedValue([mockCategory]);
      mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteCategory>>;

      await act(async () => {
        deleteResult = await result.current.deleteCategory("cat-inexistente");
      });

      expect(deleteResult!.success).toBe(false);
      expect(deleteResult!.error).toMatch(/no existe|ya fue eliminada/i);
    });
  });

  // ─── reactivateCategory ──────────────────────────────────────────────────────

  describe("reactivateCategory", () => {
    it("éxito: devuelve success=true con la categoría reactivada y llama al endpoint correcto", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockResolvedValue(mockCategory);

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let reactivateResult: Awaited<ReturnType<typeof result.current.reactivateCategory>>;

      await act(async () => {
        reactivateResult = await result.current.reactivateCategory("cat-deleted-1");
      });

      expect(reactivateResult!.success).toBe(true);
      expect(reactivateResult!.category).toEqual(mockCategory);
      expect(mockApiPost).toHaveBeenCalledWith("/categories/cat-deleted-1/reactivate", {});
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      let reactivateResult: Awaited<ReturnType<typeof result.current.reactivateCategory>>;

      await act(async () => {
        reactivateResult = await result.current.reactivateCategory("cat-deleted-1");
      });

      expect(reactivateResult!.success).toBe(false);
      expect(reactivateResult!.error).toBeTruthy();
    });
  });

  // ─── useQuery: cargar lista ──────────────────────────────────────────────────

  describe("categories query", () => {
    it("carga la lista de categorías desde GET /categories", async () => {
      mockApiGet.mockResolvedValue([mockCategory]);

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.categories).toEqual([mockCategory]);
      expect(mockApiGet).toHaveBeenCalledWith("/categories");
    });

    it("isLoading es true durante la carga inicial", () => {
      mockApiGet.mockReturnValue(new Promise(() => {})); // nunca resuelve

      const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
    });
  });
});
