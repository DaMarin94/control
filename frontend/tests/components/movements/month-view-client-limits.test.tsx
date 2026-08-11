/**
 * Tests de integración: marca visual pasiva de límites en /mes (P2 — Fase 1).
 *
 * Complementa month-view-client.test.tsx (que ya prueba, con `limits` ausente,
 * que la pantalla se ve igual que antes — 83 tests sin cambios tras cablear
 * el sistema). Acá se agrega `preferences.limits` y se verifica que:
 * - Con `limits: []` no aparece ningún nodo/aria-label de marca (cero impacto, D9).
 * - mes.total.gasto cruzado → aparece el badge/glyph con el texto accesible.
 * - mes.item.monto cruzado → aparece la marca en la fila del ítem.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";
import type { LimitConfig } from "@/types/limit";
import type { UserPreferences } from "@/types/auth";

// ─── Mocks (mismo patrón que month-view-client.test.tsx) ──────────────────────

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string, categoriesKey: string | null = null) =>
    ["movements", month, categoriesKey],
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

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
    isAuthenticated: true,
  })),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { accessToken: "test-token", preferences: {} },
    status: "authenticated",
    update: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  })),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [
      { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" as const, isActive: true },
    ],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/hooks/use-payment-methods", () => ({
  usePaymentMethods: vi.fn(() => ({ paymentMethods: [], isLoading: false, isError: false })),
}));

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(() => ({ skipRecurring: vi.fn() })),
}));

vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(() => ({ skipInstallment: vi.fn() })),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: vi.fn(() => ({ skipTransaction: vi.fn() })),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({
    defaultCurrency: "ARS",
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, getCurrentMonth: vi.fn(() => "2026-06") };
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/mes"),
}));

import { useMovements } from "@/hooks/use-movements";
import { MonthViewClient } from "@/components/movements/month-view-client";

const mockUseMovements = vi.mocked(useMovements);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function renderMonthView() {
  return render(<MonthViewClient month="2026-06" />, { wrapper: createWrapper() });
}

const mockMovementExpense = {
  id: "mov-1",
  origin: "unico" as const,
  type: "EXPENSE" as const,
  amountCents: 500000,
  description: "Super",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  startMonth: null,
  endMonth: null,
  chainId: null,
  skipped: false,
  category: { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" as const },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: 500000, // $5000
  simulated: false,
  calculatedChildren: [],
};

const mockData: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 500000, incomeCents: 0, balanceCents: -500000 },
  movements: { unicos: [mockMovementExpense], fijos: [], cuotas: [] },
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

describe("Marca visual pasiva de límites en /mes", () => {
  it("con limits=[] no aparece ninguna marca (cero impacto, D9)", () => {
    preferencesOverride = limitsPreferences([]);
    mockLoaded(mockData);
    renderMonthView();

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
    renderMonthView();

    expect(screen.getByTitle(/supera el límite: tope de gastos/i)).toBeInTheDocument();
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
    renderMonthView();

    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });

  it("mes.item.monto cruzado → marca visible en la fila del ítem", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.item.monto",
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // el ítem vale $5000
        nature: "passive",
        effect: "badge",
        label: "Gasto grande",
      },
    ]);
    mockLoaded(mockData);
    renderMonthView();

    expect(screen.getByTitle(/supera el límite: gasto grande/i)).toBeInTheDocument();
  });

  it("mes.categoria.gastoMes SIN label → texto a11y a nivel categoría-mes, no el monto de la fila", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.categoria.gastoMes",
        refinement: { categoryId: "cat-1" },
        temporalScope: "all",
        operator: "gt",
        threshold: 1000, // la categoría "Alimentación" acumula $5000 en el mock
        nature: "passive",
        effect: "badge",
      },
    ]);
    mockLoaded(mockData);
    renderMonthView();

    expect(
      screen.getByTitle(/gasto del mes en alimentación supera el límite/i),
    ).toBeInTheDocument();
  });

  it("temporalScope 'current' NO marca en un mes que no es el mes en curso", () => {
    preferencesOverride = limitsPreferences([
      {
        id: "l1",
        enabled: true,
        anchorKey: "mes.total.gasto",
        temporalScope: "current",
        operator: "gt",
        threshold: 1000,
        nature: "passive",
        effect: "badge",
        label: "Tope de gastos",
      },
    ]);
    mockLoaded(mockData);
    // getCurrentMonth() está mockeado a "2026-06"; renderMonthView también usa "2026-06"
    // así que para probar "current" que NO aplica, renderizamos un mes distinto.
    render(<MonthViewClient month="2026-05" />, { wrapper: createWrapper() });

    expect(screen.queryByTitle(/supera el límite/i)).not.toBeInTheDocument();
  });
});
