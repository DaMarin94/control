/**
 * Tests del hook usePaymentMethods.
 * Verifica: crear (éxito, 409 activo, 409 reactivable, error servidor),
 * editar (éxito, 409 colisión), eliminar (éxito, error), reactivar (éxito, error).
 * Espejo de tests/hooks/use-categories.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { ApiError } from "@/types/api";
import type { PaymentMethod } from "@/types/payment-method";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// Método de pago de ejemplo
const mockPaymentMethod: PaymentMethod = {
  id: "pm-1",
  userId: "user-1",
  name: "Visa Banco Nación",
  type: "CREDIT",
  icon: "visa",
  closingDay: 15,
  paymentDay: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  movementCount: 2,
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

describe("usePaymentMethods", () => {
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

  // ─── createPaymentMethod ────────────────────────────────────────────────────

  describe("createPaymentMethod", () => {
    it("éxito: devuelve success=true con el método creado", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockResolvedValue(mockPaymentMethod);

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createPaymentMethod>>;

      await act(async () => {
        createResult = await result.current.createPaymentMethod({
          name: "Visa Banco Nación",
          type: "CREDIT",
          icon: "visa",
          closingDay: 15,
          paymentDay: 10,
        });
      });

      expect(createResult!.success).toBe(true);
      expect(createResult!.paymentMethod).toEqual(mockPaymentMethod);
      expect(mockApiPost).toHaveBeenCalledWith("/payment-methods", {
        name: "Visa Banco Nación",
        type: "CREDIT",
        icon: "visa",
        closingDay: 15,
        paymentDay: 10,
      });
    });

    it("409 sin error.data: devuelve nameConflict=true (colisión con activo)", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(
        new ApiError("Ya existe un método de pago activo con ese nombre", 409),
      );

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createPaymentMethod>>;

      await act(async () => {
        createResult = await result.current.createPaymentMethod({ name: "Visa", type: "CREDIT" });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.nameConflict).toBe(true);
      expect(createResult!.reactivable).toBeUndefined();
    });

    it("409 con error.data.reactivable=true: devuelve los datos para el prompt", async () => {
      mockApiGet.mockResolvedValue([]);

      const reactivableData = {
        reactivable: true,
        paymentMethod: {
          id: "pm-deleted-1",
          name: "Visa Banco Nación",
          type: "CREDIT",
          icon: "visa",
        },
      };

      mockApiPost.mockRejectedValue(
        new ApiError("Ya tenés un método de pago eliminado reactivable", 409, {
          data: reactivableData,
        }),
      );

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createPaymentMethod>>;

      await act(async () => {
        createResult = await result.current.createPaymentMethod({
          name: "Visa Banco Nación",
          type: "CREDIT",
        });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.nameConflict).toBeUndefined();
      expect(createResult!.reactivable).toEqual(reactivableData.paymentMethod);
      expect(createResult!.reactivable?.id).toBe("pm-deleted-1");
    });

    it("error de servidor (500): devuelve error genérico", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let createResult: Awaited<ReturnType<typeof result.current.createPaymentMethod>>;

      await act(async () => {
        createResult = await result.current.createPaymentMethod({ name: "Test", type: "CASH" });
      });

      expect(createResult!.success).toBe(false);
      expect(createResult!.error).toMatch(/error/i);
    });
  });

  // ─── updatePaymentMethod ────────────────────────────────────────────────────

  describe("updatePaymentMethod", () => {
    it("éxito: devuelve success=true con el método actualizado", async () => {
      mockApiGet.mockResolvedValue([mockPaymentMethod]);
      const updated = { ...mockPaymentMethod, name: "Visa Banco Galicia" };
      mockApiPatch.mockResolvedValue(updated);

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updatePaymentMethod>>;

      await act(async () => {
        updateResult = await result.current.updatePaymentMethod("pm-1", {
          name: "Visa Banco Galicia",
        });
      });

      expect(updateResult!.success).toBe(true);
      expect(updateResult!.paymentMethod?.name).toBe("Visa Banco Galicia");
      expect(mockApiPatch).toHaveBeenCalledWith("/payment-methods/pm-1", {
        name: "Visa Banco Galicia",
      });
    });

    it("409: devuelve nameConflict=true", async () => {
      mockApiGet.mockResolvedValue([mockPaymentMethod]);
      mockApiPatch.mockRejectedValue(new ApiError("Nombre en uso", 409));

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let updateResult: Awaited<ReturnType<typeof result.current.updatePaymentMethod>>;

      await act(async () => {
        updateResult = await result.current.updatePaymentMethod("pm-1", { name: "Otro" });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.nameConflict).toBe(true);
    });
  });

  // ─── deletePaymentMethod ────────────────────────────────────────────────────

  describe("deletePaymentMethod", () => {
    it("éxito: devuelve success=true y llama a DELETE /payment-methods/:id", async () => {
      mockApiGet.mockResolvedValue([mockPaymentMethod]);
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePaymentMethod>>;

      await act(async () => {
        deleteResult = await result.current.deletePaymentMethod("pm-1");
      });

      expect(deleteResult!.success).toBe(true);
      expect(mockApiDelete).toHaveBeenCalledWith("/payment-methods/pm-1");
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiGet.mockResolvedValue([mockPaymentMethod]);
      mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePaymentMethod>>;

      await act(async () => {
        deleteResult = await result.current.deletePaymentMethod("pm-inexistente");
      });

      expect(deleteResult!.success).toBe(false);
      expect(deleteResult!.error).toMatch(/no existe|ya fue eliminado/i);
    });
  });

  // ─── reactivatePaymentMethod ────────────────────────────────────────────────

  describe("reactivatePaymentMethod", () => {
    it("éxito: devuelve success=true con el método reactivado y llama al endpoint correcto", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockResolvedValue(mockPaymentMethod);

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let reactivateResult: Awaited<ReturnType<typeof result.current.reactivatePaymentMethod>>;

      await act(async () => {
        reactivateResult = await result.current.reactivatePaymentMethod("pm-deleted-1");
      });

      expect(reactivateResult!.success).toBe(true);
      expect(reactivateResult!.paymentMethod).toEqual(mockPaymentMethod);
      expect(mockApiPost).toHaveBeenCalledWith("/payment-methods/pm-deleted-1/reactivate", {});
    });

    it("404: devuelve error descriptivo", async () => {
      mockApiGet.mockResolvedValue([]);
      mockApiPost.mockRejectedValue(new ApiError("Not found", 404));

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      let reactivateResult: Awaited<ReturnType<typeof result.current.reactivatePaymentMethod>>;

      await act(async () => {
        reactivateResult = await result.current.reactivatePaymentMethod("pm-deleted-1");
      });

      expect(reactivateResult!.success).toBe(false);
      expect(reactivateResult!.error).toBeTruthy();
    });
  });

  // ─── useQuery: cargar lista ──────────────────────────────────────────────────

  describe("paymentMethods query", () => {
    it("carga la lista de métodos de pago desde GET /payment-methods", async () => {
      mockApiGet.mockResolvedValue([mockPaymentMethod]);

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.paymentMethods).toEqual([mockPaymentMethod]);
      expect(mockApiGet).toHaveBeenCalledWith("/payment-methods");
    });

    it("isLoading es true durante la carga inicial", () => {
      mockApiGet.mockReturnValue(new Promise(() => {})); // nunca resuelve

      const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
    });
  });
});
