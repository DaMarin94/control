/**
 * Tests de integración: marca visual pasiva de límites en el Dashboard (P2 —
 * Fase 1, Tramo 2). Espeja month-view-client-limits.test.tsx: el dashboard
 * reusa `mes.total.*` / `mes.balance` para el mes en curso (roadmap §2).
 *
 * - Con `limits: []` no aparece ninguna marca (cero impacto, D9).
 * - mes.total.gasto cruzado → aparece la marca con el texto accesible.
 * - mes.total.ingreso / mes.balance cruzados → ídem.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";
import type { LimitConfig } from "@/types/limit";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks (mismo patrón que dashboard-client.test.tsx) ────────────────────────

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string) => ["movements", month],
}));

vi.mock("@/components/charts/report-card", () => ({
  ReportCard: () => <div data-testid="income-expense-card" />,
}));

let preferencesOverride: UserPreferences = {};

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(() => ({
    preferences: preferencesOverride,
    setPreferences: vi.fn().mockResolvedValue({ success: true }),
    isSaving: false,
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { accessToken: "test-token", preferences: {} },
    status: "authenticated",
    update: vi.fn(),
  })),
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
    defaultCurrency: "ARS",
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-06") };
});

import { useMovements } from "@/hooks/use-movements";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

const mockUseMovements = vi.mocked(useMovements);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function renderDashboard() {
  return render(<DashboardClient />, { wrapper: createWrapper() });
}

const mockData: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 500000, incomeCents: 900000, balanceCents: 400000 },
  movements: { unicos: [], fijos: [], cuotas: [] },
};

function mockLoaded(data: MonthMovements) {
  mockUseMovements.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useMovements>);
}

function limitsPreferences(limits: LimitConfig[]): UserPreferences {
  return { limits };
}

describe("Marca visual pasiva de límites en el Dashboard", () => {
  it("con limits=[] no aparece ninguna marca (cero impacto, D9)", () => {
    preferencesOverride = limitsPreferences([]);
    mockLoaded(mockData);
    renderDashboard();

    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("mes.total.gasto cruzado → aparece la marca con el texto accesible del límite", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.total.gasto",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // $1000 — el mock tiene $5000 de gasto
        nature: "passive",
        effect: "badge",
        label: "Tope de gastos",
      },
    ]);
    mockLoaded(mockData);
    renderDashboard();

    expect(screen.getByTitle(/supera el límite: tope de gastos/i)).toBeInTheDocument();
  });

  it("mes.total.ingreso cruzado → aparece la marca", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.total.ingreso",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "glyph",
        label: "Ingreso alto",
      },
    ]);
    mockLoaded(mockData);
    renderDashboard();

    expect(screen.getByTitle(/supera el límite: ingreso alto/i)).toBeInTheDocument();
  });

  it("mes.balance cruzado (temporalScope 'current') → aparece la marca (el dashboard SIEMPRE es el mes en curso)", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.balance",
        temporalScope: "current",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "badge",
        label: "Balance sano",
      },
    ]);
    mockLoaded(mockData);
    renderDashboard();

    expect(screen.getByTitle(/supera el límite: balance sano/i)).toBeInTheDocument();
  });

  it("un límite DESHABILITADO no dispara marca alguna", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: false,
        anchorKey: "mes.total.gasto",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "badge",
        label: "Tope de gastos",
      },
    ]);
    mockLoaded(mockData);
    renderDashboard();

    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });
});
