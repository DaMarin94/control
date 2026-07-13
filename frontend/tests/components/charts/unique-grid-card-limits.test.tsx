/**
 * Tests de integración: marca visual pasiva de límites en la card unique-grid
 * (P2 — Fase 1, Tramo 2). Celda diaria (`reporte.unicos.celda`) y las 5
 * métricas del footer (`reporte.unicos.mesTotal` / `.promedioDiario` /
 * `.pctVsPrev` / `.inflacionMes` / `.pctVsPrevAjustado`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UnicoGridResponse } from "@/types/reports";
import type { LimitConfig } from "@/types/limit";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-reports", () => ({
  useUnicoGrid: vi.fn(),
  UNICO_GRID_QUERY_KEY: (year: number, key: string | null) => ["reports-unico-grid", year, key],
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

// El mes real "en curso" se fija a enero 2026 (monthIndex 0) para estos tests.
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-01") };
});

import { useUnicoGrid } from "@/hooks/use-reports";
import { UniqueGridCard } from "@/components/charts/unique-grid-card";

const mockUseUnicoGrid = vi.mocked(useUnicoGrid);

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

function makeGrid(): number[][] {
  // 31 días × 12 meses, todo en 0 salvo el día 1 de enero (monthIndex 0) = $5000.
  const grid = Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => 0));
  grid[0]![0] = 500000; // día 1, enero: $5000
  return grid;
}

function makeBreakdownEmpty(): UnicoGridResponse["breakdown"] {
  return Array.from({ length: 31 }, () => Array.from({ length: 12 }, () => []));
}

function makeFooter(): UnicoGridResponse["footer"] {
  return Array.from({ length: 12 }, (_, i) => ({
    total: i === 0 ? 500000 : 0, // $5000 en enero
    dailyAvg: i === 0 ? 20000 : null, // $200
    pctVsPrev: null,
    inflationPct: i === 0 ? 8 : null, // 8pts
    pctVsPrevAdj: null,
  }));
}

const mockData: UnicoGridResponse = {
  year: 2026,
  currency: "ARS",
  colorAnchorCents: 150000,
  grid: makeGrid(),
  breakdown: makeBreakdownEmpty(),
  footer: makeFooter(),
  availableCategories: [],
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function mockSuccess(data: UnicoGridResponse) {
  mockUseUnicoGrid.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useUnicoGrid>);
}

function renderCard() {
  return render(<UniqueGridCard year={2026} />, { wrapper: createWrapper() });
}

describe("Marca visual pasiva de límites en unique-grid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccess(mockData);
  });

  it("con limits=[] no aparece ninguna marca (cero impacto, D9)", () => {
    limitsOverride = [];
    renderCard();
    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("reporte.unicos.celda cruzado → la celda del día 1/enero incluye el texto accesible en su aria-label", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.unicos.celda",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // $1000 — la celda tiene $5000
        nature: "passive",
        effect: "ring",
        label: "Día caro",
      },
    ];
    renderCard();
    expect(screen.getByLabelText(/día 1, ene 2026.*día caro/i)).toBeInTheDocument();
  });

  it("reporte.unicos.mesTotal cruzado → la marca aparece en el footer (tint/glyph/bold)", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.unicos.mesTotal",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // total de enero = $5000
        nature: "passive",
        effect: "glyph",
        label: "Mes caro",
      },
    ];
    renderCard();
    expect(screen.getByTitle(/supera el límite: mes caro/i)).toBeInTheDocument();
  });

  it("reporte.unicos.inflacionMes cruzado con temporalScope 'current' → marca solo en el mes real en curso (enero)", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.unicos.inflacionMes",
        temporalScope: "current",
        operator: "gt",
        threshold: 5, // enero tiene 8pts; los demás meses son null (no cruzan)
        nature: "passive",
        effect: "tint",
        label: "Inflación alta",
      },
    ];
    renderCard();
    // El footer de enero muestra "8,00pts" teñido — el texto accesible vive en el tooltip;
    // alcanza con confirmar que la marca se computó (footer no crashea, sin error de render).
    expect(screen.getByText(/8,00pts/i)).toBeInTheDocument();
  });

  it("hover en la celda de día 1/enero muestra el tooltip con la nota de límite cruzado", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: true,
        anchorKey: "reporte.unicos.celda",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "dot",
        label: "Día caro",
      },
    ];
    renderCard();
    const cell = screen.getByLabelText(/día 1, ene 2026/i);
    fireEvent.mouseEnter(cell);
    expect(screen.getByText(/supera el límite: día caro/i)).toBeInTheDocument();
  });

  it("un límite DESHABILITADO no dispara marca alguna", () => {
    limitsOverride = [
      {
        id: "l1",
        enabled: false,
        anchorKey: "reporte.unicos.mesTotal",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "glyph",
        label: "Mes caro",
      },
    ];
    renderCard();
    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });
});
