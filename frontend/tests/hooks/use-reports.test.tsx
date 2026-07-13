/**
 * Tests del hook useReports (Fase 1.1.5 / Fase 1.1.6 / Ola 3 P3 / RF-REP-014).
 *
 * Verifica:
 * - REPORTS_QUERY_KEY genera la query key correcta (varía por año, categoriesKey, currency, typesKey, directionKey)
 * - Fase 1.1.6: distingue null (todas), "" (ninguna), string (subconjunto) en la key de categorías
 * - Ola 3 P3: currency en la key y en la URL
 * - RF-REP-014: movementTypes en la key y en la URL (tipos de movimiento)
 * - RF-REP-014: direction en la key y en la URL (dirección de cómputo)
 * - useReports llama a GET /movements/reports?year=YYYY (sin filtro ni moneda)
 * - useReports incluye categories= en la URL cuando hay filtro
 * - Fase 1.1.6: categoryIds=[] manda &categories= vacío (= ninguna)
 * - Ola 3 P3: currency presente → agrega &currency=XXX a la URL
 * - Ola 3 P3: currency ausente → NO agrega el param (comportamiento actual)
 * - RF-REP-014: movementTypes ausente/todos → NO agrega &types= (back-compat)
 * - RF-REP-014: movementTypes subconjunto → agrega &types= con CSV
 * - RF-REP-014: direction ausente/"both" → NO agrega &direction= (back-compat)
 * - RF-REP-014: direction "expense"/"income" → agrega &direction=
 * - Estados isLoading/data/isError
 * - enabled: isAuthenticated (no dispara sin autenticación)
 * - El contrato de la respuesta (months × 12, categories con monthlyExpenseCents × 12)
 * - Invariante: suma de monthlyExpenseCents[i] == months[i].expenseCents
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReports, REPORTS_QUERY_KEY, useUnicoGrid, UNICO_GRID_QUERY_KEY } from "@/hooks/use-reports";
import { ApiError } from "@/types/api";
import type { ReportsMovementsResponse, UnicoGridResponse } from "@/types/reports";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(),
}));

import { useApi } from "@/hooks/use-api";

const mockUseApi = vi.mocked(useApi);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockReportsResponse: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: i < 6 ? 50000 : 0,
    expenseCents: i < 6 ? 20000 : 0,
  })),
  categories: [
    {
      categoryId: "cat-1",
      name: "Alimentación",
      color: "#4F86C6",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => i < 6 ? 10000 : 0),
    },
    {
      categoryId: "cat-2",
      name: "Transporte",
      color: "#E07B54",
      monthlyExpenseCents: Array.from({ length: 12 }, (_, i) => i < 6 ? 10000 : 0),
    },
  ],
  availableCategories: [
    { categoryId: "cat-1", name: "Alimentación", color: "#4F86C6" },
    { categoryId: "cat-2", name: "Transporte", color: "#E07B54" },
  ],
  earliestYear: 2025,
};

const mockEmptyReportsResponse: ReportsMovementsResponse = {
  year: 2026,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
  })),
  categories: [],
  availableCategories: [],
  earliestYear: null,
};

// ─── Wrapper con QueryClient ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// ─── Tests REPORTS_QUERY_KEY ─────────────────────────────────────────────────

describe("REPORTS_QUERY_KEY", () => {
  it("genera la query key correcta para año sin filtros (6 elementos)", () => {
    // 6 elementos: ["reports", year, categoriesKey, currency??null, typesKey??null, directionKey??null]
    expect(REPORTS_QUERY_KEY(2026, null)).toEqual(["reports", 2026, null, null, null, null]);
  });

  it("genera la query key correcta para año con filtro de categorías (sin moneda)", () => {
    expect(REPORTS_QUERY_KEY(2026, "cat-1,cat-2")).toEqual(["reports", 2026, "cat-1,cat-2", null, null, null]);
  });

  it("query keys de años distintos son distintas", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(REPORTS_QUERY_KEY(2025, null));
  });

  it("query keys con distintos filtros de categoría son distintas (refetch al cambiar categorías)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(REPORTS_QUERY_KEY(2026, "cat-1"));
    expect(REPORTS_QUERY_KEY(2026, "cat-1")).not.toEqual(REPORTS_QUERY_KEY(2026, "cat-1,cat-2"));
  });

  it("null y '' (ninguna) producen query keys distintas — Fase 1.1.6", () => {
    // Crítico: React Query necesita distinguir "todas" de "ninguna"
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(REPORTS_QUERY_KEY(2026, ""));
  });

  it("el primer elemento siempre es 'reports'", () => {
    expect(REPORTS_QUERY_KEY(2024, null)[0]).toBe("reports");
  });

  it("el segundo elemento es el año", () => {
    expect(REPORTS_QUERY_KEY(2025, null)[1]).toBe(2025);
  });

  it("el tercer elemento es la clave de categorías", () => {
    expect(REPORTS_QUERY_KEY(2026, "abc")[2]).toBe("abc");
    expect(REPORTS_QUERY_KEY(2026, null)[2]).toBeNull();
  });

  // ── Ola 3 P3: currency en la query key ──────────────────────────────────────

  it("el cuarto elemento es null cuando no se pasa currency (default global)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)[3]).toBeNull();
  });

  it("el cuarto elemento es el código de moneda cuando se pasa currency", () => {
    expect(REPORTS_QUERY_KEY(2026, null, "USD")[3]).toBe("USD");
    expect(REPORTS_QUERY_KEY(2026, null, "EUR")[3]).toBe("EUR");
    expect(REPORTS_QUERY_KEY(2026, null, "BRL")[3]).toBe("BRL");
    expect(REPORTS_QUERY_KEY(2026, null, "ARS")[3]).toBe("ARS");
  });

  it("query keys con distinta moneda son distintas (refetch al cambiar moneda)", () => {
    expect(REPORTS_QUERY_KEY(2026, null, "ARS")).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, "USD"),
    );
  });

  it("query key sin moneda es distinta de con moneda (refetch al agregar override)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, "ARS"),
    );
  });

  // ── RF-REP-014: movementTypes en la query key ─────────────────────────────

  it("el quinto elemento es null cuando typesKey no se pasa (= todos los tipos, back-compat)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)[4]).toBeNull();
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null)[4]).toBeNull();
  });

  it("el quinto elemento es '' cuando typesKey es '' (= ningún tipo)", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, "")[4]).toBe("");
  });

  it("el quinto elemento es el CSV de tipos cuando hay subconjunto", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, "fijo")[4]).toBe("fijo");
    expect(REPORTS_QUERY_KEY(2026, null, undefined, "cuota,fijo")[4]).toBe("cuota,fijo");
  });

  it("null y '' producen query keys distintas para typesKey (refetch correcto)", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null)).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, undefined, ""),
    );
  });

  it("query keys con distinto subconjunto de tipos son distintas", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, "fijo")).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, undefined, "cuota,fijo"),
    );
  });

  // ── RF-REP-014: direction en la query key ────────────────────────────────

  it("el sexto elemento es null cuando directionKey no se pasa (= both, back-compat)", () => {
    expect(REPORTS_QUERY_KEY(2026, null)[5]).toBeNull();
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null, null)[5]).toBeNull();
  });

  it("el sexto elemento es 'expense' cuando directionKey='expense'", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null, "expense")[5]).toBe("expense");
  });

  it("el sexto elemento es 'income' cuando directionKey='income'", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null, "income")[5]).toBe("income");
  });

  it("query keys con distinta dirección son distintas (refetch correcto)", () => {
    expect(REPORTS_QUERY_KEY(2026, null, undefined, null, "expense")).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, undefined, null, "income"),
    );
    expect(REPORTS_QUERY_KEY(2026, null)).not.toEqual(
      REPORTS_QUERY_KEY(2026, null, undefined, null, "expense"),
    );
  });

});

// ─── Tests useReports ─────────────────────────────────────────────────────────

describe("useReports", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("llama a GET /movements/reports?year=2026 (sin filtro, categoryIds=null)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockApiGet).toHaveBeenCalledWith("/movements/reports?year=2026");
  });

  it("incluye categories= en la URL cuando hay filtro", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, ["cat-1", "cat-2"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // La URL debe contener categories= con los ids ordenados
    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("year=2026");
    expect(callUrl).toContain("categories=cat-1,cat-2");
  });

  it("NO incluye categories= cuando categoryIds es null (= todas)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("categories=");
  });

  it("manda &categories= vacío cuando categoryIds es [] (= ninguna) — Fase 1.1.6", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, []), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    // Debe mandar el param presente y vacío
    expect(callUrl).toBe("/movements/reports?year=2026&categories=");
  });

  it("ordena los categoryIds antes de serializarlos (key estable)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    // Pasar en orden distinto → la URL debe tener los ids ordenados
    const { result } = renderHook(
      () => useReports(2026, ["cat-2", "cat-1"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("categories=cat-1,cat-2");
  });

  // ── Ola 3 P3: currency en la URL ────────────────────────────────────────────

  it("NO agrega &currency= cuando currency es undefined (default global)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null, undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("currency=");
  });

  it("agrega &currency=USD cuando currency='USD'", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null, "USD"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&currency=USD");
  });

  it("agrega &currency=EUR cuando currency='EUR'", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026, null, "EUR"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&currency=EUR");
  });

  it("combina categories= y &currency= en la URL correctamente", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, ["cat-1"], "BRL"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("year=2026");
    expect(callUrl).toContain("categories=cat-1");
    expect(callUrl).toContain("&currency=BRL");
  });

  it("refetcha al cambiar currency (query keys distintas)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result, rerender } = renderHook(
      ({ curr }: { curr: "ARS" | "USD" | undefined }) => useReports(2026, null, curr),
      { wrapper: createWrapper(), initialProps: { curr: "ARS" as const } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet.mock.calls[0]?.[0]).toContain("&currency=ARS");

    // Cambiar a USD → nueva query key → nuevo fetch
    mockApiGet.mockResolvedValue(mockReportsResponse);
    rerender({ curr: "USD" });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    const secondUrl = mockApiGet.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain("&currency=USD");
  });

  it("expone los datos tras la carga exitosa", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockReportsResponse);
    expect(result.current.data?.year).toBe(2026);
    expect(result.current.data?.months).toHaveLength(12);
    expect(result.current.data?.earliestYear).toBe(2025);
  });

  it("months siempre tiene 12 entradas", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.months).toHaveLength(12);
  });

  it("monthlyExpenseCents de cada categoría tiene 12 valores", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    result.current.data!.categories.forEach((cat) => {
      expect(cat.monthlyExpenseCents).toHaveLength(12);
    });
  });

  it("isLoading es true durante la carga", () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("isError es true cuando la API falla", async () => {
    mockApiGet.mockRejectedValue(new ApiError("Server Error", 500));

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("earliestYear es null cuando no hay movimientos", async () => {
    mockApiGet.mockResolvedValue(mockEmptyReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.earliestYear).toBeNull();
    expect(result.current.data!.categories).toHaveLength(0);
  });

  it("no dispara la query si isAuthenticated es false", () => {
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: undefined,
      isAuthenticated: false,
    });

    renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("earliestYear NO es afectado por el filtro de categorías", async () => {
    // El backend siempre devuelve earliestYear independiente del filtro;
    // el frontend simplemente lo expone tal cual.
    const filteredResponse: ReportsMovementsResponse = {
      ...mockReportsResponse,
      categories: [mockReportsResponse.categories[0]!],
      earliestYear: 2025, // No cambia aunque filtre categorías
    };
    mockApiGet.mockResolvedValue(filteredResponse);

    const { result } = renderHook(() => useReports(2026, ["cat-1"]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.earliestYear).toBe(2025);
  });

  it("mantiene datos previos (keepPreviousData) al cambiar la query key — no isLoading durante refetch", async () => {
    // Simula el escenario de toggle de categoría:
    // 1. Primera carga con categoryIds=null → datos llegan.
    // 2. Toggle a categoryIds=["cat-1"] → nueva query key, pero con keepPreviousData:
    //    isLoading queda false y data tiene los datos anteriores (no undefined).
    // Nota: en los tests de renderHook no tenemos acceso directo a keepPreviousData,
    // pero verificamos que tras el primer render exitoso el hook no vuelve a isLoading=true
    // al cambiar el parámetro (comportamiento garantizado por keepPreviousData en TQ v5).
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result, rerender } = renderHook(
      ({ catIds }: { catIds: string[] | null }) => useReports(2026, catIds),
      { wrapper: createWrapper(), initialProps: { catIds: null } }
    );

    // Primera carga exitosa
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();

    // Cambiar filtro → nueva query key; con keepPreviousData isLoading NO sube a true
    // porque hay datos en placeholder (los datos previos)
    mockApiGet.mockResolvedValue({
      ...mockReportsResponse,
      categories: [mockReportsResponse.categories[0]!],
    });
    rerender({ catIds: ["cat-1"] });

    // Con keepPreviousData: isLoading permanece false (datos previos disponibles como placeholder)
    expect(result.current.isLoading).toBe(false);
    // Y data sigue siendo los datos previos mientras refetcha
    expect(result.current.data).toBeDefined();
  });

  // ── RF-REP-014: movementTypes en la URL ─────────────────────────────────────

  it("NO agrega &types= cuando movementTypes es undefined (= todos, back-compat)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, undefined),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("types=");
  });

  it("NO agrega &types= cuando movementTypes tiene los 3 tipos (equivale a 'todos')", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, ["fijo", "cuota", "unico"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("types=");
  });

  it("agrega &types= vacío cuando movementTypes=[] (= ninguno)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, []),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toBe("/movements/reports?year=2026&types=");
  });

  it("agrega &types=fijo cuando movementTypes=['fijo']", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, ["fijo"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&types=fijo");
  });

  it("agrega &types=cuota,fijo cuando movementTypes=['fijo','cuota'] (ordenado)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, ["fijo", "cuota"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    // Los tipos se ordenan al serializar (cuota < fijo < unico)
    expect(callUrl).toContain("&types=cuota,fijo");
  });

  it("back-compat: card sin movementTypes → URL sin &types= (mismo comportamiento que hoy)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    // Simula una card vieja que no tiene movementTypes en su config
    const { result } = renderHook(
      () => useReports(2026, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toBe("/movements/reports?year=2026");
    expect(callUrl).not.toContain("types=");
    expect(callUrl).not.toContain("direction=");
  });

  // ── RF-REP-014: direction en la URL ─────────────────────────────────────────

  it("NO agrega &direction= cuando direction es undefined (= both, back-compat)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, undefined, undefined),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("direction=");
  });

  it("NO agrega &direction= cuando direction='both' (equivale a default)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, undefined, "both"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("direction=");
  });

  it("agrega &direction=expense cuando direction='expense'", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, undefined, "expense"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&direction=expense");
  });

  it("agrega &direction=income cuando direction='income'", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, null, undefined, undefined, "income"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&direction=income");
  });

  it("combina todos los params en la URL correctamente (RF-REP-014 full)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(
      () => useReports(2026, ["cat-1"], "USD", ["fijo"], "expense"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("year=2026");
    expect(callUrl).toContain("categories=cat-1");
    expect(callUrl).toContain("&currency=USD");
    expect(callUrl).toContain("&types=fijo");
    expect(callUrl).toContain("&direction=expense");
  });

  it("refetcha al cambiar direction (query keys distintas)", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result, rerender } = renderHook(
      ({ dir }: { dir: "expense" | "income" | "both" | undefined }) =>
        useReports(2026, null, undefined, undefined, dir),
      { wrapper: createWrapper(), initialProps: { dir: undefined } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet.mock.calls[0]?.[0]).not.toContain("direction=");

    // Cambiar a "expense" → nueva query key → nuevo fetch
    mockApiGet.mockResolvedValue(mockReportsResponse);
    rerender({ dir: "expense" });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    const secondUrl = mockApiGet.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain("&direction=expense");
  });

  it("invariante: suma de monthlyExpenseCents[i] == months[i].expenseCents", async () => {
    mockApiGet.mockResolvedValue(mockReportsResponse);

    const { result } = renderHook(() => useReports(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const { months, categories } = result.current.data!;
    months.forEach((month, i) => {
      const sum = categories.reduce(
        (acc, cat) => acc + (cat.monthlyExpenseCents[i] ?? 0),
        0
      );
      expect(sum).toBe(month.expenseCents);
    });
  });
});

// ─── Tests UNICO_GRID_QUERY_KEY / useUnicoGrid — techo editable (Ola 3, P3) ───

const mockUnicoGridResponse: UnicoGridResponse = {
  year: 2026,
  currency: "ARS",
  colorAnchorCents: 150000,
  anchorUsdCents: 1500,
  grid: Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => 0)),
  breakdown: Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => [])),
  footer: Array.from({ length: 12 }, () => ({
    total: 0,
    dailyAvg: 0,
    pctVsPrev: null,
    inflationPct: null,
    pctVsPrevAdj: null,
  })),
  availableCategories: [],
};

describe("UNICO_GRID_QUERY_KEY", () => {
  it("el sexto elemento es null cuando anchorUsdCents no se pasa (techo estándar)", () => {
    expect(UNICO_GRID_QUERY_KEY(2026, null)[5]).toBeNull();
  });

  it("el sexto elemento es el valor de anchorUsdCents cuando se pasa (techo custom)", () => {
    expect(UNICO_GRID_QUERY_KEY(2026, null, undefined, undefined, 5000)[5]).toBe(5000);
  });

  it("query keys con distinto anchorUsdCents son distintas (refetch al cambiar el techo)", () => {
    expect(UNICO_GRID_QUERY_KEY(2026, null, undefined, undefined, 1500)).not.toEqual(
      UNICO_GRID_QUERY_KEY(2026, null, undefined, undefined, 5000),
    );
    expect(UNICO_GRID_QUERY_KEY(2026, null)).not.toEqual(
      UNICO_GRID_QUERY_KEY(2026, null, undefined, undefined, 1500),
    );
  });
});

describe("useUnicoGrid — techo editable (Ola 3, P3)", () => {
  const mockApiGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      api: {
        get: mockApiGet,
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
      token: "test-token",
      isAuthenticated: true,
    });
  });

  it("NO agrega anchorAmountCents/anchorCurrency cuando anchorUsdCents es undefined (techo estándar)", async () => {
    mockApiGet.mockResolvedValue(mockUnicoGridResponse);

    const { result } = renderHook(
      () => useUnicoGrid(2026, null, undefined, "2026-03-15"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("anchorAmountCents=");
    expect(callUrl).not.toContain("anchorCurrency=");
  });

  it("agrega &anchorAmountCents=N&anchorCurrency=USD cuando anchorUsdCents está presente", async () => {
    mockApiGet.mockResolvedValue(mockUnicoGridResponse);

    const { result } = renderHook(
      () => useUnicoGrid(2026, null, undefined, "2026-03-15", 5000),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&anchorAmountCents=5000");
    expect(callUrl).toContain("&anchorCurrency=USD");
  });

  it("el ancla es independiente de la moneda de display de la card", async () => {
    mockApiGet.mockResolvedValue(mockUnicoGridResponse);

    const { result } = renderHook(
      () => useUnicoGrid(2026, null, "EUR", "2026-03-15", 5000),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callUrl = mockApiGet.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("&currency=EUR");
    expect(callUrl).toContain("&anchorAmountCents=5000&anchorCurrency=USD");
  });

  it("refetcha al cambiar anchorUsdCents (query keys distintas)", async () => {
    mockApiGet.mockResolvedValue(mockUnicoGridResponse);

    const { result, rerender } = renderHook(
      ({ anchor }: { anchor: number | undefined }) =>
        useUnicoGrid(2026, null, undefined, "2026-03-15", anchor),
      { wrapper: createWrapper(), initialProps: { anchor: undefined as number | undefined } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet.mock.calls[0]?.[0]).not.toContain("anchorAmountCents=");

    mockApiGet.mockResolvedValue(mockUnicoGridResponse);
    rerender({ anchor: 5000 });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    const secondUrl = mockApiGet.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain("&anchorAmountCents=5000&anchorCurrency=USD");
  });

  it("expone anchorUsdCents del response", async () => {
    mockApiGet.mockResolvedValue(mockUnicoGridResponse);

    const { result } = renderHook(
      () => useUnicoGrid(2026, null, undefined, "2026-03-15"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.anchorUsdCents).toBe(1500);
  });
});
