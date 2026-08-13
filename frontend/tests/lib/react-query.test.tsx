/**
 * Tests del manejo centralizado de 401 en react-query.tsx (RF-AUTH).
 *
 * El QueryClient se crea vía createQueryClient() (exportada para poder
 * instanciarla en tests sin montar el árbol de providers). El flag de
 * "ya manejé el 401" vive a nivel de módulo, así que cada test reimporta
 * el módulo con vi.resetModules() para partir de un estado limpio.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  // Sesión "viva" con token presente — usado por los tests de integración con
  // useReports más abajo, que ejercitan la cadena REAL apiRequest → ApiError →
  // QueryCache.onError, no un fetchQuery armado a mano.
  useSession: vi.fn(() => ({
    data: { accessToken: "a-token", user: { id: "u1" } },
    status: "authenticated",
  })),
}));

vi.mock("@/components/ui/toast", () => ({
  emitToast: vi.fn(),
}));

describe("react-query — manejo centralizado de 401", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // location por defecto en jsdom no es /login
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/mes" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ante un 401 en una query: muestra el toast y llama a signOut una sola vez", async () => {
    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["test-401"],
        queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
        retry: false,
      }),
    ).rejects.toThrow();

    expect(emitToast).toHaveBeenCalledTimes(1);
    expect(emitToast).toHaveBeenCalledWith("error", "Tu sesión expiró, volvé a entrar.");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("guard: múltiples 401 concurrentes disparan un único toast/signOut", async () => {
    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    const results = await Promise.allSettled([
      queryClient.fetchQuery({
        queryKey: ["test-401-a"],
        queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
        retry: false,
      }),
      queryClient.fetchQuery({
        queryKey: ["test-401-b"],
        queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
        retry: false,
      }),
      queryClient.fetchQuery({
        queryKey: ["test-401-c"],
        queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
        retry: false,
      }),
    ]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(emitToast).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("un 403 (permisos) NO dispara toast ni signOut", async () => {
    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["test-403"],
        queryFn: () => Promise.reject(new ApiError("Forbidden", 403)),
        retry: false,
      }),
    ).rejects.toThrow();

    expect(emitToast).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("un 500 (servidor) NO dispara toast ni signOut", async () => {
    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["test-500"],
        queryFn: () => Promise.reject(new ApiError("Internal Server Error", 500)),
        retry: false,
      }),
    ).rejects.toThrow();

    expect(emitToast).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("un 401 en una mutation también dispara toast + signOut", async () => {
    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
      });

    await expect(mutation.execute({})).rejects.toThrow();

    expect(emitToast).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("no dispara toast/signOut si ya está en /login", async () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/login" },
      writable: true,
    });

    const { createQueryClient } = await import("@/lib/react-query");
    const { ApiError } = await import("@/types/api");
    const { signOut } = await import("next-auth/react");
    const { emitToast } = await import("@/components/ui/toast");

    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["test-401-login"],
        queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
        retry: false,
      }),
    ).rejects.toThrow();

    expect(emitToast).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  // ── Integración con un hook REAL (no un fetchQuery armado a mano) ───────────
  //
  // Los tests de arriba prueban el mecanismo con queryFns sintéticas. Estos dos
  // ejercitan la cadena de producción completa: useReports (hook real) →
  // apiRequest (capa real de API) → ApiError → QueryCache.onError del
  // createQueryClient real — sin este nivel, un 401 que nunca llegara a
  // convertirse en ApiError, o una queryFn que lo tragara, pasaría inadvertido.
  describe("integración con un hook de datos real (useReports)", () => {
    const errorEnvelope = {
      success: false,
      statusCode: 401,
      error: { message: "Token inválido o expirado", timestamp: new Date().toISOString(), path: "/x" },
    };

    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        json: async () => errorEnvelope,
      } as Response);
    });

    it("un 401 real de useReports termina en toast + signOut (cadena de producción completa)", async () => {
      const { createQueryClient } = await import("@/lib/react-query");
      const { useReports } = await import("@/hooks/use-reports");
      const { signOut } = await import("next-auth/react");
      const { emitToast } = await import("@/components/ui/toast");

      const queryClient = createQueryClient();
      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      const { result } = renderHook(() => useReports(2026, null), { wrapper: Wrapper });

      await waitFor(() => expect(signOut).toHaveBeenCalled(), { timeout: 5000 });

      expect(emitToast).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
      // La query en sí debe resolver a error — nunca quedar "pending" para siempre.
      expect(result.current.isError).toBe(true);
    }, 10000);

    it("guard ya disparado por un 401 anterior: la SEGUNDA query real igual llega a isError (no queda colgada en isLoading)", async () => {
      const { createQueryClient } = await import("@/lib/react-query");
      const { useReports } = await import("@/hooks/use-reports");
      const { ApiError } = await import("@/types/api");
      const { signOut } = await import("next-auth/react");
      const { emitToast } = await import("@/components/ui/toast");

      const queryClient = createQueryClient();

      // 1) Dispara el guard con un 401 "ya manejado" (ej: otra query de la
      // misma página que resolvió primero).
      await expect(
        queryClient.fetchQuery({
          queryKey: ["prime-guard"],
          queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
          retry: false,
        }),
      ).rejects.toThrow();
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(emitToast).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // 2) Con el guard ya en true, monta un useReports real que también 401.
      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }
      const { result } = renderHook(() => useReports(2026, null), { wrapper: Wrapper });

      // Regla de negocio: el guard deduplica el toast/signOut (correcto, un solo
      // aviso por sesión de página) — PERO la query no debe quedar "pending"
      // para siempre: debe resolver a error igual, para que la UI muestre el
      // estado de error en vez de un skeleton eterno.
      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

      expect(signOut).not.toHaveBeenCalled();
      expect(emitToast).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    }, 10000);
  });

  // ── Regresión: el 401 no debe colgarse si la pestaña pierde visibilidad ────
  //
  // Gotcha de TanStack Query: entre el primer fallo y el reintento programado
  // (retryDelay ~1s), si `document.visibilityState !== "visible"` en ese
  // instante (p.ej. Chrome "occlusion" al tapar la pestaña con otra ventana —
  // típico al restart-ear el backend desde una terminal), el retryer entra en
  // estado "paused" y NUNCA transiciona a "error" hasta que la pestaña vuelve
  // a estar visible. Mientras está paused, QueryCache.onError no dispara →
  // sin toast, sin signOut, pantalla colgada en skeleton para siempre.
  //
  // La solución (createQueryClient: retry excluye el 401) evita la ventana de
  // espera por completo: un 401 nunca programa un reintento, así que la
  // pestaña oculta es irrelevante — el error se propaga en el mismo tick.
  //
  // Corre contra el `ReactQueryProvider` REAL (el que monta layout.tsx), no
  // un QueryClient armado a mano en el test — cierra el punto ciego: si algún
  // día apareciera un segundo QueryClientProvider en el árbol real, o el hook
  // dejara de correr bajo este provider, esta cadena (provider real → hook
  // real → apiRequest real → ApiError → QueryCache.onError real) lo expondría.
  describe("regresión: 401 con la pestaña sin visibilidad no cuelga la query", () => {
    const errorEnvelope = {
      success: false,
      statusCode: 401,
      error: { message: "Token inválido o expirado", timestamp: new Date().toISOString(), path: "/x" },
    };

    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        json: async () => errorEnvelope,
      } as Response);
    });

    afterEach(() => {
      // Restaurar visibilidad real para no filtrar estado entre tests.
      focusManager.setFocused(undefined);
    });

    it("con la pestaña oculta durante todo el ciclo, useReports bajo el ReactQueryProvider real igual termina en toast + signOut (no cuelga)", async () => {
      const { ReactQueryProvider } = await import("@/lib/react-query");
      const { useReports } = await import("@/hooks/use-reports");
      const { signOut } = await import("next-auth/react");
      const { emitToast } = await import("@/components/ui/toast");

      // Simula la pestaña tapada/oculta (Chrome window occlusion) desde antes
      // de que la query dispare y durante todo el resto del test.
      focusManager.setFocused(false);

      const { result } = renderHook(() => useReports(2026, null), { wrapper: ReactQueryProvider });

      // Antes del fix, este await colgaba indefinidamente (fetchStatus quedaba
      // "paused" para siempre) — el timeout corto documenta que ya no reintenta.
      await waitFor(() => expect(signOut).toHaveBeenCalled(), { timeout: 3000 });

      expect(emitToast).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
      expect(result.current.isError).toBe(true);
      expect(result.current.isLoading).toBe(false);

      // El backend nunca fue llamado una segunda vez: el 401 no reintenta.
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, 5000);
  });
});
