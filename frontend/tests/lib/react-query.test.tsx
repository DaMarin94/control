/**
 * Tests del manejo centralizado de 401 en react-query.tsx (RF-AUTH).
 *
 * El QueryClient se crea vía createQueryClient() (exportada para poder
 * instanciarla en tests sin montar el árbol de providers). El flag de
 * "ya manejé el 401" vive a nivel de módulo, así que cada test reimporta
 * el módulo con vi.resetModules() para partir de un estado limpio.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, screen, act, fireEvent, waitFor } from "@testing-library/react";
import {
  QueryClientProvider,
  focusManager,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
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

// Gate de arranque del backend: se espía la señal, el resto del módulo (sonda,
// constantes) queda real.
vi.mock("@/lib/backend-gate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-gate")>();
  return { ...actual, notifyBackendUnreachable: vi.fn() };
});

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

  // ── Gate de arranque del backend: 503 de red → señal al gate ───────────────
  //
  // Caso real: la pestaña queda abierta, el backend se duerme a los ~15 min
  // (plan free de Render), el usuario vuelve y hace click. El fallo de red
  // llega como ApiError 503 (lib/api.ts, bloque `catch (networkError)`) y se
  // engancha en el MISMO punto único que el 401 — sin repetir el chequeo en
  // cada hook.
  describe("503 (backend inalcanzable) → avisa al gate de arranque", () => {
    it("un 503 en una query notifica al gate y NO desloguea", async () => {
      const { createQueryClient } = await import("@/lib/react-query");
      const { ApiError } = await import("@/types/api");
      const { notifyBackendUnreachable } = await import("@/lib/backend-gate");
      const { signOut } = await import("next-auth/react");
      const { emitToast } = await import("@/components/ui/toast");

      const queryClient = createQueryClient();

      await expect(
        queryClient.fetchQuery({
          queryKey: ["test-503"],
          queryFn: () =>
            Promise.reject(new ApiError("No se pudo conectar con el servidor: failed", 503)),
          retry: false,
        }),
      ).rejects.toThrow();

      expect(notifyBackendUnreachable).toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
      expect(emitToast).not.toHaveBeenCalled();
    });

    it("un 503 en una mutation también notifica al gate", async () => {
      const { createQueryClient } = await import("@/lib/react-query");
      const { ApiError } = await import("@/types/api");
      const { notifyBackendUnreachable } = await import("@/lib/backend-gate");

      const queryClient = createQueryClient();

      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: () => Promise.reject(new ApiError("No se pudo conectar", 503)),
      });

      await expect(mutation.execute({})).rejects.toThrow();

      expect(notifyBackendUnreachable).toHaveBeenCalled();
    });

    it("un 401 o un 500 NO notifican al gate", async () => {
      const { createQueryClient } = await import("@/lib/react-query");
      const { ApiError } = await import("@/types/api");
      const { notifyBackendUnreachable } = await import("@/lib/backend-gate");

      const queryClient = createQueryClient();

      await expect(
        queryClient.fetchQuery({
          queryKey: ["test-401-no-gate"],
          queryFn: () => Promise.reject(new ApiError("Unauthorized", 401)),
          retry: false,
        }),
      ).rejects.toThrow();

      await expect(
        queryClient.fetchQuery({
          queryKey: ["test-500-no-gate"],
          queryFn: () => Promise.reject(new ApiError("Internal Server Error", 500)),
          retry: false,
        }),
      ).rejects.toThrow();

      expect(notifyBackendUnreachable).not.toHaveBeenCalled();
    });
  });

  // ── Recuperación del backend → rescate de las queries que fallaron ─────────
  //
  // Defecto que cierra (QA visual): con el backend dormido, las queries de la
  // pantalla fallaban por red y quedaban en `error` DEBAJO del gate. Al
  // despertar el backend el gate se retiraba prolijo… y abajo quedaba "No se
  // pudieron cargar los totales del mes. Intentá recargar la página." — el
  // usuario tenía que recargar igual, así que la espera no servía de nada.
  //
  // Contracara crítica: una MUTACIÓN que falló con el backend dormido NO se
  // re-ejecuta jamás sola (reintentar a ciegas podría duplicar un gasto).
  describe("recuperación del backend → refetch de las queries en error", () => {
    /** Panel mínimo con una query (se muestra) y una mutación (se dispara a mano). */
    function Panel({
      queryFn,
      mutationFn,
    }: {
      queryFn: () => Promise<{ total: number }>;
      mutationFn: () => Promise<void>;
    }) {
      const totals = useQuery({ queryKey: ["totales-del-mes"], queryFn, retry: false });
      const save = useMutation({ mutationFn });

      return (
        <div>
          <span data-testid="totals">
            {totals.isError ? "error" : totals.data ? `ok:${totals.data.total}` : "cargando"}
          </span>
          <span data-testid="save">{save.status}</span>
          <button type="button" onClick={() => save.mutate()}>
            guardar
          </button>
        </div>
      );
    }

    it("al volver el backend, la query que falló se vuelve a pedir sola y la mutación fallida NO", async () => {
      const { ReactQueryProvider } = await import("@/lib/react-query");
      const { notifyBackendRecovered } = await import("@/lib/backend-gate");
      const { ApiError } = await import("@/types/api");

      const networkError = () => new ApiError("No se pudo conectar con el servidor", 503);
      // Primera pasada (backend dormido) falla; la segunda —ya despierto— trae datos.
      const queryFn = vi
        .fn<() => Promise<{ total: number }>>()
        .mockRejectedValueOnce(networkError())
        .mockResolvedValue({ total: 42 });
      const mutationFn = vi.fn<() => Promise<void>>().mockRejectedValue(networkError());

      render(
        <ReactQueryProvider>
          <Panel queryFn={queryFn} mutationFn={mutationFn} />
        </ReactQueryProvider>,
      );

      // Backend dormido: la query muere y el usuario ve el cartel de error.
      await waitFor(() => expect(screen.getByTestId("totals")).toHaveTextContent("error"));

      // El usuario intentó guardar durante la espera: la mutación también falla.
      fireEvent.click(screen.getByRole("button", { name: "guardar" }));
      await waitFor(() => expect(screen.getByTestId("save")).toHaveTextContent("error"));

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(mutationFn).toHaveBeenCalledTimes(1);

      // El gate detecta que el backend volvió (un solo disparo por recuperación).
      act(() => {
        notifyBackendRecovered();
      });

      // La query se rescata sola: el usuario ve sus datos sin tocar nada.
      await waitFor(() => expect(screen.getByTestId("totals")).toHaveTextContent("ok:42"));
      expect(queryFn).toHaveBeenCalledTimes(2);

      // La mutación queda exactamente como estaba: NUNCA se re-ejecuta.
      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("save")).toHaveTextContent("error");
    });

    it("no arma una tormenta: las queries que SÍ tienen datos no se vuelven a pedir", async () => {
      const { ReactQueryProvider } = await import("@/lib/react-query");
      const { notifyBackendRecovered } = await import("@/lib/backend-gate");

      const queryFn = vi.fn<() => Promise<{ total: number }>>().mockResolvedValue({ total: 7 });
      const mutationFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      render(
        <ReactQueryProvider>
          <Panel queryFn={queryFn} mutationFn={mutationFn} />
        </ReactQueryProvider>,
      );

      await waitFor(() => expect(screen.getByTestId("totals")).toHaveTextContent("ok:7"));
      expect(queryFn).toHaveBeenCalledTimes(1);

      act(() => {
        notifyBackendRecovered();
      });

      // Backend recién arrancado y frío: solo se rescata lo que falló.
      await Promise.resolve();
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("sin suscriptor activo (provider desmontado) la señal no revienta", async () => {
      const { ReactQueryProvider } = await import("@/lib/react-query");
      const { notifyBackendRecovered } = await import("@/lib/backend-gate");

      const queryFn = vi.fn<() => Promise<{ total: number }>>().mockResolvedValue({ total: 1 });
      const mutationFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      const { unmount } = render(
        <ReactQueryProvider>
          <Panel queryFn={queryFn} mutationFn={mutationFn} />
        </ReactQueryProvider>,
      );
      await waitFor(() => expect(screen.getByTestId("totals")).toHaveTextContent("ok:1"));
      unmount();

      expect(() => notifyBackendRecovered()).not.toThrow();
    });
  });
});
