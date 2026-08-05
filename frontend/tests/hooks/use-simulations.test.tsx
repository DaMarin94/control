/**
 * Tests de los hooks de Simulación de categoría — /simulations (RF-SIM-001..004).
 * Verifica: GET /simulations y /simulations/candidates (gateados por
 * isAuthenticated / enabled), POST /simulations (éxito con invalidación de
 * ["simulations"] + candidates + ["movements"]; 400/409; error de servidor),
 * DELETE /simulations/:id (éxito con las mismas invalidaciones; 404; error de servidor).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useSimulations,
  useSimulationCandidates,
  useCreateSimulation,
  useDeleteSimulation,
  SIMULATIONS_QUERY_KEY,
  SIMULATION_CANDIDATES_QUERY_KEY,
} from "@/hooks/use-simulations";
import { ApiError } from "@/types/api";
import type { SimulationDto, SimulationsListResponse, SimulationCandidatesResponse } from "@/types/simulation";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

const mockSimulation: SimulationDto = {
  id: "sim-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Suscripciones", color: "#3B7DE0", scope: "BOTH" },
  monthsWithData: 5,
  paused: false,
  createdAt: "2026-06-02T17:30:00.000Z",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useSimulations", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("carga la lista desde GET /simulations con today=YYYY-MM-DD", async () => {
    const response: SimulationsListResponse = { horizonEndMonth: "2026-12", simulations: [mockSimulation] };
    mockApiGet.mockResolvedValue(response);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSimulations(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(response);
    });
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/simulations\?today=\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("no dispara la query si no está autenticado (evita 401 espurio)", () => {
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: undefined,
      isAuthenticated: false,
    });
    const { Wrapper } = createWrapper();

    renderHook(() => useSimulations(), { wrapper: Wrapper });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("manda el today con la fecha LOCAL (no la UTC) cerca de medianoche en UTC-3 (RN-028)", async () => {
    const response: SimulationsListResponse = { horizonEndMonth: "2026-12", simulations: [] };
    mockApiGet.mockResolvedValue(response);

    const originalTZ = process.env.TZ;
    process.env.TZ = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano

    // Solo se fakea Date (no setTimeout/setInterval), así waitFor sigue funcionando.
    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-07-31T23:00:00 en Buenos Aires (UTC-3) = 2026-08-01T02:00:00Z.
    // El día UTC ya rodó a agosto; el día LOCAL del usuario todavía es 31 de julio.
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));

    try {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSimulations(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("today=2026-07-31");
      expect(callUrl).not.toContain("today=2026-08-01");
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTZ;
    }
  });
});

describe("useSimulationCandidates", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: mockApiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("no dispara la query mientras el modal está cerrado (enabled=false)", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useSimulationCandidates(false), { wrapper: Wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("dispara GET /simulations/candidates con today=YYYY-MM-DD cuando enabled=true", async () => {
    const response: SimulationCandidatesResponse = {
      horizonEndMonth: "2026-12",
      categories: [{ categoryId: "cat-1", name: "Suscripciones", color: "#3B7DE0", monthsWithData: 5, alreadySimulated: false }],
    };
    mockApiGet.mockResolvedValue(response);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSimulationCandidates(true), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(response);
    });
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/simulations\/candidates\?today=\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("manda el today con la fecha LOCAL (no la UTC) cerca de medianoche en UTC-3 (RN-028)", async () => {
    const response: SimulationCandidatesResponse = { horizonEndMonth: "2026-12", categories: [] };
    mockApiGet.mockResolvedValue(response);

    const originalTZ = process.env.TZ;
    process.env.TZ = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano

    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-07-31T23:00:00 en Buenos Aires (UTC-3) = 2026-08-01T02:00:00Z.
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));

    try {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSimulationCandidates(true), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("today=2026-07-31");
      expect(callUrl).not.toContain("today=2026-08-01");
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTZ;
    }
  });
});

describe("useCreateSimulation", () => {
  const mockApiPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: vi.fn(), post: mockApiPost, patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("éxito: llama POST /simulations con { categoryId } y devuelve la simulación creada", async () => {
    mockApiPost.mockResolvedValue(mockSimulation);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    let createResult: Awaited<ReturnType<typeof result.current.createSimulation>>;
    await act(async () => {
      createResult = await result.current.createSimulation("cat-1");
    });

    expect(createResult!.success).toBe(true);
    expect(createResult!.simulation).toEqual(mockSimulation);
    expect(mockApiPost).toHaveBeenCalledWith(
      expect.stringMatching(/^\/simulations\?today=\d{4}-\d{2}-\d{2}$/),
      { categoryId: "cat-1" }
    );
  });

  it("manda el today con la fecha LOCAL (no la UTC) cerca de medianoche en UTC-3 (RN-028)", async () => {
    mockApiPost.mockResolvedValue(mockSimulation);

    const originalTZ = process.env.TZ;
    process.env.TZ = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano

    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-07-31T23:00:00 en Buenos Aires (UTC-3) = 2026-08-01T02:00:00Z.
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));

    try {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.createSimulation("cat-1");
      });

      const callUrl = mockApiPost.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("today=2026-07-31");
      expect(callUrl).not.toContain("today=2026-08-01");
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTZ;
    }
  });

  it("éxito: invalida simulations, candidates y movements", async () => {
    mockApiPost.mockResolvedValue(mockSimulation);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.createSimulation("cat-1");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(SIMULATIONS_QUERY_KEY);
    expect(invalidatedKeys).toContainEqual(SIMULATION_CANDIDATES_QUERY_KEY);
    expect(invalidatedKeys).toContainEqual(["movements"]);
  });

  it("400 (menos de 3 meses con datos): propaga el mensaje del backend", async () => {
    mockApiPost.mockRejectedValue(new ApiError("La categoría necesita al menos 3 meses con movimientos únicos en los últimos 12 meses (tiene 1)", 400));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    let createResult: Awaited<ReturnType<typeof result.current.createSimulation>>;
    await act(async () => {
      createResult = await result.current.createSimulation("cat-1");
    });

    expect(createResult!.success).toBe(false);
    expect(createResult!.error).toMatch(/al menos 3 meses/i);
  });

  it("409 (ya simulada): propaga el mensaje del backend", async () => {
    mockApiPost.mockRejectedValue(new ApiError("Ya tenés una simulación activa para esta categoría", 409));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    let createResult: Awaited<ReturnType<typeof result.current.createSimulation>>;
    await act(async () => {
      createResult = await result.current.createSimulation("cat-1");
    });

    expect(createResult!.success).toBe(false);
    expect(createResult!.error).toMatch(/ya tenés una simulación activa/i);
  });

  it("error de servidor (500): mensaje genérico", async () => {
    mockApiPost.mockRejectedValue(new ApiError("Internal Server Error", 500));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    let createResult: Awaited<ReturnType<typeof result.current.createSimulation>>;
    await act(async () => {
      createResult = await result.current.createSimulation("cat-1");
    });

    expect(createResult!.success).toBe(false);
    expect(createResult!.error).toMatch(/no se pudo crear/i);
  });

  it("isCreating pasa a true mientras la mutación está pendiente", async () => {
    mockApiPost.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateSimulation(), { wrapper: Wrapper });

    act(() => {
      void result.current.createSimulation("cat-1");
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    });
  });
});

describe("useDeleteSimulation", () => {
  const mockApiDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: mockApiDelete, put: vi.fn() },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("éxito: llama DELETE /simulations/:id y devuelve success=true", async () => {
    mockApiDelete.mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteSimulation(), { wrapper: Wrapper });

    let deleteResult: Awaited<ReturnType<typeof result.current.deleteSimulation>>;
    await act(async () => {
      deleteResult = await result.current.deleteSimulation("sim-1");
    });

    expect(deleteResult!.success).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith("/simulations/sim-1");
  });

  it("éxito: invalida simulations, candidates y movements", async () => {
    mockApiDelete.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteSimulation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.deleteSimulation("sim-1");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(SIMULATIONS_QUERY_KEY);
    expect(invalidatedKeys).toContainEqual(SIMULATION_CANDIDATES_QUERY_KEY);
    expect(invalidatedKeys).toContainEqual(["movements"]);
  });

  it("404: la simulación no existe o ya fue eliminada", async () => {
    mockApiDelete.mockRejectedValue(new ApiError("Not found", 404));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteSimulation(), { wrapper: Wrapper });

    let deleteResult: Awaited<ReturnType<typeof result.current.deleteSimulation>>;
    await act(async () => {
      deleteResult = await result.current.deleteSimulation("sim-1");
    });

    expect(deleteResult!.success).toBe(false);
    expect(deleteResult!.error).toMatch(/no existe o ya fue eliminada/i);
  });

  it("error de servidor (500): mensaje genérico", async () => {
    mockApiDelete.mockRejectedValue(new ApiError("Internal Server Error", 500));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteSimulation(), { wrapper: Wrapper });

    let deleteResult: Awaited<ReturnType<typeof result.current.deleteSimulation>>;
    await act(async () => {
      deleteResult = await result.current.deleteSimulation("sim-1");
    });

    expect(deleteResult!.success).toBe(false);
    expect(deleteResult!.error).toMatch(/no se pudo eliminar/i);
  });
});
