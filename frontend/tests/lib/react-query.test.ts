/**
 * Tests del manejo centralizado de 401 en react-query.tsx (RF-AUTH).
 *
 * El QueryClient se crea vía createQueryClient() (exportada para poder
 * instanciarla en tests sin montar el árbol de providers). El flag de
 * "ya manejé el 401" vive a nivel de módulo, así que cada test reimporta
 * el módulo con vi.resetModules() para partir de un estado limpio.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
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
});
