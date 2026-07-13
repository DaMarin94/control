/**
 * Tests de integración: marca visual pasiva de límites en la card
 * installment-gantt (P2 — Fase 1, Tramo 2). reporte.cuotas.montoPorCuota /
 * .cantidadCuotas (bar: glyph/badge/ring), evaluado sobre el período REAL del
 * plan (realStartMonth/realEndMonth), no sobre el año navegado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CuotasGanttResponse } from "@/types/reports";
import type { LimitConfig } from "@/types/limit";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useCuotasGantt: vi.fn(),
  CUOTAS_GANTT_QUERY_KEY: (year: number, key: string | null) => ["reports-cuotas-gantt", year, key],
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    settings: { defaultCurrency: "ARS", lastExchangeRate: null },
    defaultCurrency: "ARS",
    lastExchangeRate: null,
    isLoading: false,
    isError: false,
    updateSettings: vi.fn(),
    isSaving: false,
  })),
}));

let limitsOverride: LimitConfig[] = [];

vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(() => ({
    limits: limitsOverride,
    isLoading: false,
    isSaving: false,
    create: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
  })),
}));

// Mock de useCategories (P2 — popover informativo de límites): resuelve nombre/color
// de categoría para el refinamiento de límites. [] no afecta las marcas de estos tests.
vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({ categories: [], isLoading: false, isError: false })),
}));

// Mes real "en curso": junio 2026 — dentro del período de "bar-1" (2026-01..2026-12)
// y fuera del período de "bar-2" (2025-01..2025-06, ver mockData abajo).
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-06") };
});

import { useCuotasGantt } from "@/hooks/use-reports";
import { CuotasGanttCard } from "@/components/charts/cuotas-gantt-card";

const mockUseCuotasGantt = vi.mocked(useCuotasGantt);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockData: CuotasGanttResponse = {
  year: 2026,
  currency: "ARS",
  bars: [
    {
      id: "bar-1",
      description: "Netflix",
      categoryId: "cat-1",
      amountCents: 500000, // $5000 por cuota
      startMonthIndex: 0,
      endMonthIndex: 5,
      continuesBefore: false,
      continuesAfter: false,
      installmentFrom: 1,
      installmentTo: 6,
      totalInstallments: 12,
      rowIndex: 0,
      realStartMonth: "2026-01",
      realEndMonth: "2026-12", // activo en el mes real (2026-06)
    },
    {
      id: "bar-2",
      description: "Compra vieja",
      categoryId: "cat-1",
      amountCents: 500000,
      startMonthIndex: 6,
      endMonthIndex: 11,
      continuesBefore: false,
      continuesAfter: false,
      installmentFrom: 1,
      installmentTo: 6,
      totalInstallments: 6,
      rowIndex: 1,
      realStartMonth: "2025-01",
      realEndMonth: "2025-06", // YA no activo en el mes real (2026-06)
    },
  ],
  rowCount: 2,
  availableCategories: [{ categoryId: "cat-1", name: "Entretenimiento", color: "#4F86C6" }],
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function mockSuccess(data: CuotasGanttResponse) {
  mockUseCuotasGantt.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCuotasGantt>);
}

function renderCard() {
  return render(<CuotasGanttCard year={2026} />, { wrapper: createWrapper() });
}

describe("Marca visual pasiva de límites en installment-gantt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccess(mockData);
  });

  it("con limits=[] no aparece ninguna marca (cero impacto, D9)", () => {
    limitsOverride = [];
    renderCard();
    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("reporte.cuotas.montoPorCuota cruzado → aparece la marca en la barra (glyph)", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.cuotas.montoPorCuota",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // $1000 — ambas barras tienen $5000
        nature: "passive",
        effect: "glyph",
        label: "Cuota cara",
      },
    ];
    renderCard();
    expect(screen.getAllByTitle(/supera el límite: cuota cara/i).length).toBeGreaterThan(0);
  });

  it("temporalScope 'current' solo marca el plan cuyo período REAL incluye el mes real en curso", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.cuotas.montoPorCuota",
        temporalScope: "current",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "glyph",
        label: "Cuota cara",
      },
    ];
    renderCard();
    // bar-1 (2026-01..2026-12, activo en 2026-06) → marcado.
    expect(screen.getByRole("row", { name: /netflix.*supera el límite: cuota cara/i })).toBeInTheDocument();
    // bar-2 (2025-01..2025-06, YA no activo en 2026-06) → NO marcado.
    expect(screen.getByRole("row", { name: /compra vieja/i })).not.toHaveAccessibleName(/supera el límite/i);
  });

  it("hover en la barra marcada muestra el tooltip con la nota de límite cruzado", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.cuotas.cantidadCuotas",
        temporalScope: "all",
        operator: "gt",
        threshold: 5, // bar-1 tiene 12 cuotas, bar-2 tiene 6
        nature: "passive",
        effect: "ring",
        label: "Plan largo",
      },
    ];
    renderCard();
    const bar = screen.getByRole("row", { name: /netflix/i });
    fireEvent.mouseEnter(bar);
    expect(screen.getByText(/supera el límite: plan largo/i)).toBeInTheDocument();
  });

  it("un límite DESHABILITADO no dispara marca alguna", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: false,
        anchorKey: "reporte.cuotas.montoPorCuota",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "glyph",
        label: "Cuota cara",
      },
    ];
    renderCard();
    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });
});
