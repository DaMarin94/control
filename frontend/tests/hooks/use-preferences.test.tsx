/**
 * Tests del hook usePreferences (Fase 1.1.0).
 *
 * Verifica:
 * - PREFERENCES_QUERY_KEY tiene el valor correcto
 * - setPreferences llama a PUT /preferences con { data: blob } y actualiza la sesión
 * - setPreferences retorna success=true con las preferencias persistidas en éxito
 * - setPreferences retorna el error adecuado en 400 / 401 / error de red
 * - Las preferences iniciales se toman de la sesión (initialData)
 * - Tras refresh (sesión que resuelve tarde), GET /preferences se dispara y sirve el blob real del backend
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePreferences, PREFERENCES_QUERY_KEY } from "@/hooks/use-preferences";
import { ApiError } from "@/types/api";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";
import { useSession } from "next-auth/react";

const mockUseApi = vi.mocked(useApi);
const mockUseSession = vi.mocked(useSession);

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

// ─── Tests PREFERENCES_QUERY_KEY ──────────────────────────────────────────────

describe("PREFERENCES_QUERY_KEY", () => {
  it("tiene el valor correcto", () => {
    expect(PREFERENCES_QUERY_KEY).toEqual(["preferences"]);
  });
});

// ─── Tests usePreferences ─────────────────────────────────────────────────────

describe("usePreferences", () => {
  const mockApiGet = vi.fn();
  const mockApiPut = vi.fn();
  const mockUpdateSession = vi.fn();

  const mockPreferences: UserPreferences = { collapsedSections: ["fixed"] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: mockApiPut,
      },
      token: "test-token",
      isAuthenticated: true,
    });
    mockUseSession.mockReturnValue({
      data: { preferences: {}, accessToken: "test-token", expires: "2099-01-01T00:00:00.000Z", user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
      update: mockUpdateSession,
    } as ReturnType<typeof useSession>);
  });

  // ─── Valor inicial ──────────────────────────────────────────────────────────

  it("expone preferences={} cuando la sesión no tiene preferencias", () => {
    mockApiGet.mockResolvedValue({});

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    // El initialData viene de la sesión (que mockeamos con {})
    expect(result.current.preferences).toEqual({});
  });

  it("expone las preferences de la sesión como initialData", () => {
    mockApiGet.mockResolvedValue(mockPreferences);
    mockUseSession.mockReturnValue({
      data: { preferences: mockPreferences, accessToken: "test-token", expires: "2099-01-01T00:00:00.000Z", user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
      update: mockUpdateSession,
    } as ReturnType<typeof useSession>);

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    // El initialData refleja el valor de la sesión de inmediato (sin esperar la query)
    expect(result.current.preferences).toEqual(mockPreferences);
  });

  // ─── setPreferences: éxito ──────────────────────────────────────────────────

  it("setPreferences llama a PUT /preferences con { data: blob }", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockResolvedValue(mockPreferences);
    mockUpdateSession.mockResolvedValue(null);

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.setPreferences(mockPreferences);
    });

    expect(mockApiPut).toHaveBeenCalledWith("/preferences", { data: mockPreferences });
  });

  it("setPreferences retorna success=true con el blob persistido", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockResolvedValue(mockPreferences);
    mockUpdateSession.mockResolvedValue(null);

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    let setResult: Awaited<ReturnType<typeof result.current.setPreferences>>;

    await act(async () => {
      setResult = await result.current.setPreferences(mockPreferences);
    });

    expect(setResult!.success).toBe(true);
    expect(setResult!.preferences).toEqual(mockPreferences);
  });

  it("setPreferences llama a updateSession con el blob persistido", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockResolvedValue(mockPreferences);
    mockUpdateSession.mockResolvedValue(null);

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.setPreferences(mockPreferences);
    });

    expect(mockUpdateSession).toHaveBeenCalledWith({ preferences: mockPreferences });
  });

  it("setPreferences actualiza la caché de React Query tras éxito", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockResolvedValue(mockPreferences);
    mockUpdateSession.mockResolvedValue(null);

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.setPreferences(mockPreferences);
    });

    await waitFor(() => {
      expect(result.current.preferences).toEqual(mockPreferences);
    });
  });

  // ─── setPreferences: errores ────────────────────────────────────────────────

  it("setPreferences retorna error de formato en 400", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockRejectedValue(new ApiError("Bad request", 400));

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    let setResult: Awaited<ReturnType<typeof result.current.setPreferences>>;

    await act(async () => {
      setResult = await result.current.setPreferences({ invalid: true });
    });

    expect(setResult!.success).toBe(false);
    expect(setResult!.error).toContain("formato");
  });

  it("setPreferences retorna error de sesión en 401", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockRejectedValue(new ApiError("Unauthorized", 401));

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    let setResult: Awaited<ReturnType<typeof result.current.setPreferences>>;

    await act(async () => {
      setResult = await result.current.setPreferences(mockPreferences);
    });

    expect(setResult!.success).toBe(false);
    expect(setResult!.error).toContain("Sesión");
  });

  it("setPreferences retorna error genérico en error de red", async () => {
    mockApiGet.mockResolvedValue({});
    mockApiPut.mockRejectedValue(new ApiError("Network error", 503));

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    let setResult: Awaited<ReturnType<typeof result.current.setPreferences>>;

    await act(async () => {
      setResult = await result.current.setPreferences(mockPreferences);
    });

    expect(setResult!.success).toBe(false);
    expect(setResult!.error).toContain("preferencias");
  });

  // ─── isSaving ──────────────────────────────────────────────────────────────

  it("isSaving es false antes de mutar", () => {
    mockApiGet.mockResolvedValue({});

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });

    expect(result.current.isSaving).toBe(false);
  });

  // ─── Escenario refresh: sesión que resuelve tarde ───────────────────────────
  // Reproduce el bug: al refrescar, la sesión está en "loading" (isAuthenticated=false),
  // luego resuelve con el token. Con initialDataUpdatedAt=0 React Query trata el
  // initialData como stale → dispara GET /preferences en cuanto enabled=true.

  it("dispara GET /preferences cuando la sesión resuelve tras un refresh (initialDataUpdatedAt=0)", async () => {
    const blobFromBackend: UserPreferences = { theme: "dark", reports: [{ id: "r1", type: "unicos-grid" }] };
    mockApiGet.mockResolvedValue(blobFromBackend);
    mockUpdateSession.mockResolvedValue(null);

    // Arrancar con sesión en loading (no autenticado aún)
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: mockApiPut },
      token: undefined,
      isAuthenticated: false,
    });
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(() => usePreferences(), { wrapper });

    // En loading: preferences es {} (initialData), GET no disparado
    expect(result.current.preferences).toEqual({});
    expect(mockApiGet).not.toHaveBeenCalled();

    // Simular que la sesión resuelve (isAuthenticated pasa a true)
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: mockApiPut },
      token: "test-token",
      isAuthenticated: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        preferences: {},
        accessToken: "test-token",
        expires: "2099-01-01T00:00:00.000Z",
        user: { id: "user-1", email: "test@example.com" },
      },
      status: "authenticated",
      update: mockUpdateSession,
    } as ReturnType<typeof useSession>);

    rerender();

    // GET /preferences debe dispararse y las preferencias deben reflejar el blob del backend
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/preferences");
    });

    await waitFor(() => {
      expect(result.current.preferences).toEqual(blobFromBackend);
    });
  });

  it("tras refresh, las claves de reportes y tema reflejan el blob del backend", async () => {
    const blobFromBackend: UserPreferences = {
      theme: "dark",
      reports: [{ id: "r1", type: "unicos-grid", title: "Gastos" }],
    };
    mockApiGet.mockResolvedValue(blobFromBackend);
    mockUpdateSession.mockResolvedValue(null);

    // Sesión en loading al montar
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: mockApiPut },
      token: undefined,
      isAuthenticated: false,
    });
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(() => usePreferences(), { wrapper });

    // La sesión resuelve
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: mockApiPut },
      token: "test-token",
      isAuthenticated: true,
    });
    mockUseSession.mockReturnValue({
      data: {
        preferences: {},
        accessToken: "test-token",
        expires: "2099-01-01T00:00:00.000Z",
        user: { id: "user-1", email: "test@example.com" },
      },
      status: "authenticated",
      update: mockUpdateSession,
    } as ReturnType<typeof useSession>);

    rerender();

    await waitFor(() => {
      expect(result.current.preferences.theme).toBe("dark");
      expect(result.current.preferences.reports).toEqual([{ id: "r1", type: "unicos-grid", title: "Gastos" }]);
    });
  });
});
