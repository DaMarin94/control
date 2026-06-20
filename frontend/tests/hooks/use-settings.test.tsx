/**
 * Tests del hook useSettings (Fase 1.2.3).
 *
 * Verifica:
 * - SETTINGS_QUERY_KEY tiene la forma correcta
 * - useSettings expone defaultCurrency con fallback "ARS"
 * - useSettings expone lastExchangeRate (null si no viene)
 * - updateSettings llama PATCH /settings y retorna success: true en éxito
 * - updateSettings retorna success: false en error 400
 * - updateSettings retorna success: false en error de servidor
 * - onSuccess invalida queries de ["movements"] y ["reports"]
 * - isLoading mientras no hay datos
 * - enabled: isAuthenticated — no dispara query sin autenticación
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSettings, SETTINGS_QUERY_KEY } from "@/hooks/use-settings";
import { ApiError } from "@/types/api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSettings = {
  defaultCurrency: "ARS" as const,
  lastExchangeRate: null,
};

const mockSettingsWithRate = {
  defaultCurrency: "USD" as const,
  lastExchangeRate: 1200.5,
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

  return { Wrapper, queryClient };
}

// ─── Tests SETTINGS_QUERY_KEY ─────────────────────────────────────────────────

describe("SETTINGS_QUERY_KEY", () => {
  it("es ['settings']", () => {
    expect(SETTINGS_QUERY_KEY).toEqual(["settings"]);
  });
});

// ─── Tests useSettings ────────────────────────────────────────────────────────

describe("useSettings", () => {
  const mockApiGet = vi.fn();
  const mockApiPatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: mockApiPatch,
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  // ─── Valores iniciales ──────────────────────────────────────────────────────

  it("defaultCurrency tiene fallback 'ARS' mientras carga", () => {
    mockApiGet.mockResolvedValue(mockSettings);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });
    // Antes de que resuelva la query, settings es undefined
    expect(result.current.defaultCurrency).toBe("ARS");
    expect(result.current.lastExchangeRate).toBeNull();
  });

  it("expone las settings cargadas correctamente", async () => {
    mockApiGet.mockResolvedValue(mockSettingsWithRate);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultCurrency).toBe("USD");
    expect(result.current.lastExchangeRate).toBe(1200.5);
    expect(result.current.settings).toEqual(mockSettingsWithRate);
  });

  it("isLoading es true mientras la query está en vuelo", () => {
    // Mock que nunca resuelve
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  // ─── Query gate: enabled: isAuthenticated ───────────────────────────────────

  it("NO dispara la query cuando isAuthenticated=false", () => {
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: mockApiPatch,
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: undefined,
      isAuthenticated: false,
    });

    mockApiGet.mockResolvedValue(mockSettings);
    const { Wrapper } = createWrapper();
    renderHook(() => useSettings(), { wrapper: Wrapper });

    // La query no debe haberse disparado
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  // ─── updateSettings: éxito ─────────────────────────────────────────────────

  it("updateSettings llama PATCH /settings y retorna success: true", async () => {
    mockApiGet.mockResolvedValue(mockSettings);
    mockApiPatch.mockResolvedValue(mockSettingsWithRate);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });

    let updateResult: Awaited<ReturnType<typeof result.current.updateSettings>>;
    await act(async () => {
      updateResult = await result.current.updateSettings({ defaultCurrency: "USD" });
    });

    expect(mockApiPatch).toHaveBeenCalledWith("/settings", { defaultCurrency: "USD" });
    expect(updateResult!.success).toBe(true);
    expect(updateResult!.settings).toEqual(mockSettingsWithRate);
  });

  // ─── updateSettings: error 400 ─────────────────────────────────────────────

  it("updateSettings retorna success: false en error 400", async () => {
    mockApiGet.mockResolvedValue(mockSettings);
    mockApiPatch.mockRejectedValue(
      new ApiError("Moneda inválida", 400),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });

    let updateResult: Awaited<ReturnType<typeof result.current.updateSettings>>;
    await act(async () => {
      updateResult = await result.current.updateSettings({ defaultCurrency: "USD" });
    });

    expect(updateResult!.success).toBe(false);
    expect(updateResult!.error).toBe("Moneda inválida");
  });

  // ─── updateSettings: error de servidor ─────────────────────────────────────

  it("updateSettings retorna success: false en error de servidor (500)", async () => {
    mockApiGet.mockResolvedValue(mockSettings);
    mockApiPatch.mockRejectedValue(
      new ApiError("Internal server error", 500),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });

    let updateResult: Awaited<ReturnType<typeof result.current.updateSettings>>;
    await act(async () => {
      updateResult = await result.current.updateSettings({ defaultCurrency: "USD" });
    });

    expect(updateResult!.success).toBe(false);
    expect(updateResult!.error).toBeTruthy();
  });

  // ─── onSuccess: invalidación de queries ────────────────────────────────────

  it("onSuccess invalida ['movements'] y ['reports'] por prefijo", async () => {
    mockApiGet.mockResolvedValue(mockSettings);
    mockApiPatch.mockResolvedValue(mockSettingsWithRate);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSettings(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.updateSettings({ defaultCurrency: "USD" });
    });

    // Se debe haber llamado para ["movements"] y ["reports"]
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["movements"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["reports"] });
  });
});
