/**
 * Tests del MonthViewClient (RF-VM-001/002/003/004).
 *
 * Fase 1.1.4 (2026-06-16): acordeón + reordenar secciones.
 * Fase 1.1.6 (2026-06-17): filtro de categorías en /mes.
 * Fase 1.1.7/1.1.8 (2026-06-18): enrutamiento de borrado de calculados por sourceType.
 * Fase 1.2.0 (2026-06-19): colapso transitorio en modo orden + drag in-place sin DragOverlay.
 * Fase 1.2.1 (2026-06-19): filtros por sección (tipo + categoría) — filtrado en el frontend.
 * Bug E1 (2026-06-19): totales con gasto calculado (amountCents negativo) — RN-019.
 *   - Eliminado el viejo filtro por-pantalla del header (FilterButton global).
 *   - Nuevo: SectionFilterButton por sección + filtrado frontend + totales recalculados.
 *   - Nueva preferencia: monthListFilters (depreca monthCategoryFilter).
 *
 * Verifica:
 * - Navegación prev/next cambia la URL (/mes?month=YYYY-MM)
 * - Render de totales del mes
 * - Las 3 secciones se muestran SIEMPRE (incluso vacías) — P5
 * - Empty global eliminado — P5
 * - Copy de sección vacía: "Sin movimientos únicos" / "Sin fijos" / "Sin cuotas" — P5
 * - Lista agrupada: sección Únicos con ítems
 * - Lista agrupada: sección Fijos con ítems (Fase 6)
 * - Lista agrupada: sección Cuotas con ítems y "X/N" (Fase 7)
 * - Estado de error: mensaje sin romper la pantalla
 * - Colapsar/expandir persiste con setPreferences (P5)
 * - Reordenar secciones entra/sale al modo orden (P6)
 * - Modo orden: botón "Ordenar secciones" → "Listo" (P6)
 * - Modo orden: "+ Nuevo movimiento" se deshabilita (P6)
 * - Modo orden: al entrar se colapsan todas las secciones (Fase 1.2.0)
 * - Modo orden: al salir se restaura el estado de colapso previo (Fase 1.2.0)
 * - Cableado editar/eliminar: únicos → modal único / delete único
 * - Cableado editar/eliminar: fijos → modal fijo / delete fijo (Fase 6)
 * - Cableado editar/eliminar: cuotas → modal cuota / delete cuota (Fase 7)
 * - Enrutamiento de borrado de calculados: fijo → DeleteRecurringDialog; único/cuota → confirmación directa (Fase 1.1.8)
 * - Filtros por sección: disparador por sección existe / aria-expanded (Fase 1.2.1)
 * - Filtros por sección: filtro de tipo (Gasto/Ingreso/Ambos) filtra ítems en el frontend
 * - Filtros por sección: filtro de categoría filtra ítems en el frontend
 * - Filtros por sección: totales recalculados desde lo visible
 * - Filtros por sección: default fresco (Ambos + todas → sin filtrado)
 * - Filtros por sección: persistencia en setPreferences (monthListFilters)
 * - Filtros por sección: en modo orden NO aparece el disparador
 * - useMovements se llama sin filtro de backend (sin segundo parámetro)
 * - monthCategoryFilter ya NO se lee ni se escribe
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string, categoriesKey: string | null = null) =>
    ["movements", month, categoriesKey],
}));

const mockSetPreferences = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(() => ({
    preferences: {},
    setPreferences: mockSetPreferences,
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

const mockCategories = [
  { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" as const, isActive: true },
  { id: "cat-2", name: "Sueldo", color: "#33FF57", scope: "INCOME" as const, isActive: true },
];

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: mockCategories,
    isLoading: false,
    isError: false,
    error: null,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reactivateCategory: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReactivating: false,
  })),
}));

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(() => ({
    createRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    skipRecurring: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  })),
}));

vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(() => ({
    createInstallment: vi.fn(),
    updateInstallment: vi.fn(),
    deleteInstallment: vi.fn(),
    skipInstallment: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
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

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return {
    ...actual,
    getCurrentMonth: vi.fn(() => "2026-06"),
  };
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => "/mes"),
}));

import { useMovements } from "@/hooks/use-movements";
import { usePreferences } from "@/hooks/use-preferences";
import { MonthViewClient } from "@/components/movements/month-view-client";

const mockUseMovements = vi.mocked(useMovements);
const mockUsePreferences = vi.mocked(usePreferences);

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

/**
 * Helper para encontrar el botón de disclosure del acordeón de una sección.
 *
 * Con Fase 1.2.1, hay dos botones por sección en el DOM:
 *   1. El disclosure button (aria-expanded + aria-controls) — el que colapsa/expande.
 *   2. El filter button (aria-haspopup="dialog") — el SectionFilterButton.
 *
 * `getByRole("button", { name: /únicos/i })` falla porque ambos coinciden
 * (el label "Filtrar Únicos" también contiene "Únicos").
 *
 * Esta helper toma el primer botón que tenga `aria-expanded` (el disclosure),
 * usando `getAllByRole` para evitar el error de "multiple elements found".
 */
function getDisclosureButton(sectionName: RegExp): HTMLElement {
  const allButtons = screen.getAllByRole("button", { name: sectionName });
  const disclosure = allButtons.find(
    (btn) => btn.hasAttribute("aria-expanded") && btn.hasAttribute("aria-controls"),
  );
  if (!disclosure) {
    throw new Error(`No se encontró el disclosure button para la sección ${sectionName}`);
  }
  return disclosure;
}

function renderMonthView(month = "2026-06") {
  return render(<MonthViewClient month={month} />, { wrapper: createWrapper() });
}

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const mockMovementExpense = {
  id: "mov-1",
  origin: "unico" as const,
  type: "EXPENSE" as const,
  amountCents: 15000,
  description: "Almuerzo en el trabajo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null as null,
  skipped: false,
  category: { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" as const },
  calculated: null,
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: 15000,
};

const mockMovementIncome = {
  id: "mov-2",
  origin: "unico" as const,
  type: "INCOME" as const,
  amountCents: 500000,
  description: null,
  occurredAt: "2026-06-01T12:00:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null as null,
  skipped: false,
  category: { id: "cat-2", name: "Sueldo", color: "#33FF57", scope: "INCOME" as const },
  calculated: null,
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: 500000,
};

const mockMovementFijo = {
  id: "rec-1",
  origin: "fijo" as const,
  type: "EXPENSE" as const,
  amountCents: 150000,
  description: "Alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: "MONTHLY" as const,
  skipped: false,
  category: { id: "cat-3", name: "Servicios", color: "#5733FF", scope: "EXPENSE" as const },
  calculated: null,
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: 150000,
};

const mockMovementCuota = {
  id: "inst-1",
  origin: "cuota" as const,
  type: "EXPENSE" as const,
  amountCents: 50000,
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: {
    number: 3,
    total: 12,
    startMonth: "2026-01",
  },
  frequency: null as null,
  skipped: false,
  category: { id: "cat-4", name: "Tecnología", color: "#FF33AA", scope: "EXPENSE" as const },
  calculated: null,
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: 50000,
};

const mockWithData: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
  movements: {
    unicos: [mockMovementExpense, mockMovementIncome],
    fijos: [],
    cuotas: [],
  },
};

const mockWithFijos: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 165000, incomeCents: 500000, balanceCents: 335000 },
  movements: {
    unicos: [mockMovementExpense],
    fijos: [mockMovementFijo],
    cuotas: [],
  },
};

const mockWithCuotas: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 65000, incomeCents: 500000, balanceCents: 435000 },
  movements: {
    unicos: [mockMovementExpense],
    fijos: [],
    cuotas: [mockMovementCuota],
  },
};

const mockEmpty: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 0, incomeCents: 0, balanceCents: 0 },
  movements: { unicos: [], fijos: [], cuotas: [] },
};

// Bug E1: gasto calculado con amountCents NEGATIVO (RN-019).
// El backend guarda calculados EXPENSE con amountCents < 0; el frontend
// debe usar Math.abs() para sumar la magnitud, no el crudo con signo.
const mockMovementCalculadoExpense = {
  id: "calc-exp-1",
  origin: "fijo" as const,
  type: "EXPENSE" as const,
  amountCents: -5000, // negativo: calculado EXPENSE
  description: "IVA del alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: "MONTHLY" as const,
  skipped: false,
  category: { id: "cat-3", name: "Servicios", color: "#5733FF", scope: "EXPENSE" as const },
  calculated: {
    sourceType: "fijo" as const,
    sourceId: "rec-1",
    sourceChainId: "chain-1",
    sourceDescription: "Alquiler",
    formulaOperator: "PCT" as const,
    formulaOperand: 2100,
    formulaSign: 1 as const,
    sourceAmountCents: 150000,
  },
  hasCalculated: false,
  currency: "ARS" as const,
  exchangeRate: 1,
  convertedAmountCents: -5000,
};

// Calculados por tipo de origen (Fase 1.1.8)
const mockCalculatedDeFijo = {
  ...mockMovementFijo,
  id: "calc-fijo-1",
  description: "Calculado de alquiler",
  calculated: {
    sourceType: "fijo" as const,
    sourceId: "rec-1",
    sourceChainId: "chain-1",
    sourceDescription: "Alquiler",
    formulaOperator: "PCT" as const,
    formulaOperand: 1000,
    formulaSign: 1 as const,
    sourceAmountCents: 150000,
  },
  hasCalculated: false,
};

const mockCalculatedDeUnico = {
  ...mockMovementExpense,
  id: "calc-unico-1",
  description: "Calculado de almuerzo",
  origin: "unico" as const,
  calculated: {
    sourceType: "unico" as const,
    sourceId: "mov-1",
    sourceChainId: null,
    sourceDescription: "Almuerzo en el trabajo",
    formulaOperator: "PCT" as const,
    formulaOperand: 1000,
    formulaSign: 1 as const,
    sourceAmountCents: 15000,
  },
  hasCalculated: false,
};

const mockCalculatedDeCuota = {
  ...mockMovementCuota,
  id: "calc-cuota-1",
  description: "Calculado de cuota notebook",
  origin: "cuota" as const,
  calculated: {
    sourceType: "cuota" as const,
    sourceId: "inst-1",
    sourceChainId: null,
    sourceDescription: "Notebook",
    formulaOperator: "PCT" as const,
    formulaOperand: 1000,
    formulaSign: 1 as const,
    sourceAmountCents: 50000,
  },
  hasCalculated: false,
};

function mockLoaded(data: MonthMovements) {
  mockUseMovements.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null,
    status: "success",
    fetchStatus: "idle",
  } as ReturnType<typeof useMovements>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MonthViewClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset del mock de preferencias a sin preferencias guardadas
    mockUsePreferences.mockReturnValue({
      preferences: {},
      setPreferences: mockSetPreferences,
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePreferences>);
    mockSetPreferences.mockResolvedValue({ success: true });
  });

  // ── Encabezado y navegación prev/next (RF-VM-004) ──────────────────────────

  describe("Navegación prev/next", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("muestra el mes activo en el encabezado", () => {
      renderMonthView("2026-06");
      const matches = screen.getAllByText(/junio/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    it("prev month navega al mes anterior (/mes?month=2026-05)", () => {
      renderMonthView("2026-06");
      const prevBtn = screen.getByRole("button", { name: /mes anterior/i });
      fireEvent.click(prevBtn);
      expect(mockPush).toHaveBeenCalledWith("/mes?month=2026-05");
    });

    it("next month navega al mes siguiente (/mes?month=2026-07)", () => {
      renderMonthView("2026-06");
      const nextBtn = screen.getByRole("button", { name: /mes siguiente/i });
      fireEvent.click(nextBtn);
      expect(mockPush).toHaveBeenCalledWith("/mes?month=2026-07");
    });

    it("prev month cruza año correctamente (2026-01 → 2025-12)", () => {
      mockLoaded({ ...mockWithData, month: "2026-01" });
      renderMonthView("2026-01");
      const prevBtn = screen.getByRole("button", { name: /mes anterior/i });
      fireEvent.click(prevBtn);
      expect(mockPush).toHaveBeenCalledWith("/mes?month=2025-12");
    });

    it("next month cruza año correctamente (2025-12 → 2026-01)", () => {
      mockLoaded({ ...mockWithData, month: "2025-12" });
      renderMonthView("2025-12");
      const nextBtn = screen.getByRole("button", { name: /mes siguiente/i });
      fireEvent.click(nextBtn);
      expect(mockPush).toHaveBeenCalledWith("/mes?month=2026-01");
    });
  });

  // ── Totales (RF-VM-002) ───────────────────────────────────────────────────

  describe("Totales del mes", () => {
    it("muestra gastos, ingresos y balance correctamente", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      expect(screen.getByText("$150,00")).toBeInTheDocument();
      expect(screen.getByText("$5.000,00")).toBeInTheDocument();
      expect(screen.getByText("+ $4.850,00")).toBeInTheDocument();
    });

    it("muestra totales en cero cuando el mes está vacío", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      const zeroes = screen.getAllByText(/\$0,00/);
      expect(zeroes.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("+ $0,00")).toBeInTheDocument();
    });

    // ── Bug E1 — gasto calculado con amountCents negativo (RN-019) ───────────
    // El backend devuelve calculados EXPENSE con amountCents < 0. El cliente
    // debe sumar la MAGNITUD (Math.abs), no el crudo, para que los totales
    // de /mes coincidan con los del dashboard (que usa totals del server).

    it("Bug E1 — gasto calculado con amountCents negativo suma su magnitud en expense (RN-019)", () => {
      // Fijos: 1 calculado EXPENSE con amountCents = -5000 (50 pesos)
      // El total de gastos debe ser 50 pesos (magnitud), NO -50 (crudo).
      // El balance debe ser −50 pesos, NO +50 (el error original).
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 5000, incomeCents: 0, balanceCents: -5000 },
        movements: {
          unicos: [],
          fijos: [mockMovementCalculadoExpense],
          cuotas: [],
        },
      });
      renderMonthView();

      // Gastos: debe mostrar $50,00 (magnitud del calculado negativo)
      expect(screen.getByText("$50,00")).toBeInTheDocument();
      // Balance: −$50,00 (gasto sin ingresos)
      expect(screen.getByText("− $50,00")).toBeInTheDocument();
      // Ingresos: $0,00
      const zeroes = screen.getAllByText("$0,00");
      expect(zeroes.length).toBeGreaterThanOrEqual(1);
    });

    it("Bug E1 — mes mixto con calculado negativo: los totales coinciden con el server (RN-019)", () => {
      // Únicos: 1 ingreso $5000 + 1 gasto normal $150
      // Fijos: 1 calculado EXPENSE amountCents=-5000 (magnitud $50)
      // Total esperado: expense = 150+50 = 200 pesos → $200,00
      //                 income  = 5000 pesos → $5.000,00
      //                 balance = 4800 pesos → +$4.800,00
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 20000, incomeCents: 500000, balanceCents: 480000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [mockMovementCalculadoExpense],
          cuotas: [],
        },
      });
      renderMonthView();

      expect(screen.getByText("$200,00")).toBeInTheDocument();   // gastos totales
      expect(screen.getByText("$5.000,00")).toBeInTheDocument(); // ingresos totales
      expect(screen.getByText("+ $4.800,00")).toBeInTheDocument(); // balance
    });

    // ── Fase 1.2.3 — multi-moneda: totales usan convertedAmountCents ─────────
    // Criterio de aceptación: con todos los ítems visibles (sin filtros),
    // el total recalculado en el front coincide con data.totals del backend
    // (que también suma convertedAmountCents por bucket de type).

    it("Fase 1.2.3 — multi-moneda: totales usan convertedAmountCents, NO amountCents", () => {
      // Ítem USD: amountCents=100 (1 USD crudo), convertedAmountCents=120000 ($1200 ARS)
      // El total de gastos debe mostrar $1200 (convertedAmountCents), NO $1 (amountCents).
      const usdExpense = {
        ...mockMovementExpense,
        id: "usd-exp-1",
        type: "EXPENSE" as const,
        amountCents: 100,           // 1 USD en centavos de USD
        currency: "USD" as const,
        exchangeRate: 1200,
        convertedAmountCents: 120000, // $1200 ARS en centavos
      };
      mockLoaded({
        month: "2026-06",
        // data.totals refleja la suma de convertedAmountCents del backend
        totals: { expenseCents: 120000, incomeCents: 0, balanceCents: -120000 },
        movements: {
          unicos: [usdExpense],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Gastos: debe mostrar $1.200,00 (convertedAmountCents / 100), NO $1,00 (amountCents / 100)
      expect(screen.getByText("$1.200,00")).toBeInTheDocument();
      // El $1,00 de amountCents NO debe aparecer en los totales
      expect(screen.queryByText("$1,00")).not.toBeInTheDocument();
      // Balance: − $1.200,00
      expect(screen.getByText("− $1.200,00")).toBeInTheDocument();
    });

    it("Fase 1.2.3 — multi-moneda: total recalculado en front coincide con data.totals del backend", () => {
      // ARS expense: amountCents=15000, convertedAmountCents=15000 ($150 ARS)
      // USD income: amountCents=20000 (200 USD), convertedAmountCents=24000000 ($240000 ARS)
      // Backend data.totals: expense=15000, income=24000000
      // Front debe calcular los mismos valores desde los ítems (sin filtros).
      const arsExpense = { ...mockMovementExpense }; // convertedAmountCents=15000
      const usdIncome = {
        ...mockMovementIncome,
        id: "usd-inc-1",
        type: "INCOME" as const,
        amountCents: 20000,
        currency: "USD" as const,
        exchangeRate: 1200,
        convertedAmountCents: 24000000,
      };
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 24000000, balanceCents: 23985000 },
        movements: {
          unicos: [arsExpense, usdIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Gastos: $150,00 (convertedAmountCents del ARS expense)
      expect(screen.getByText("$150,00")).toBeInTheDocument();
      // Ingresos: $240.000,00 (convertedAmountCents del USD income)
      expect(screen.getByText("$240.000,00")).toBeInTheDocument();
      // Balance: + $239.850,00
      expect(screen.getByText("+ $239.850,00")).toBeInTheDocument();
    });
  });

  // ── Fase 1.1.4 P5 — las 3 secciones se muestran SIEMPRE ──────────────────

  describe("Fase 1.1.4 P5 — las 3 secciones se muestran siempre (incluso vacías)", () => {
    it("muestra las 3 secciones cuando todas tienen ítems", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 215000, incomeCents: 500000, balanceCents: 285000 },
        movements: {
          unicos: [mockMovementExpense],
          fijos: [mockMovementFijo],
          cuotas: [mockMovementCuota],
        },
      });
      renderMonthView();

      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /fijos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /cuotas/i })).toBeInTheDocument();
    });

    it("muestra las 3 secciones aunque todas estén vacías", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /fijos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /cuotas/i })).toBeInTheDocument();
    });

    it("muestra sección Fijos aunque esté vacía (cuando solo hay únicos)", () => {
      mockLoaded(mockWithData); // fijos: []
      renderMonthView();

      expect(screen.getByRole("region", { name: /fijos/i })).toBeInTheDocument();
    });

    it("muestra sección Cuotas aunque esté vacía", () => {
      mockLoaded(mockWithData); // cuotas: []
      renderMonthView();

      expect(screen.getByRole("region", { name: /cuotas/i })).toBeInTheDocument();
    });

    it("muestra sección Únicos aunque esté vacía", () => {
      mockLoaded({
        ...mockEmpty,
        movements: { unicos: [], fijos: [mockMovementFijo], cuotas: [] },
      });
      renderMonthView();

      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
    });

    it("NO muestra el empty global 'No hay movimientos' (eliminado en Fase 1.1.4)", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.queryByText(/no hay movimientos/i)).not.toBeInTheDocument();
    });

    it("muestra el copy de sección vacía para Únicos", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.getByText("Sin movimientos únicos")).toBeInTheDocument();
    });

    it("muestra el copy de sección vacía para Fijos", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.getByText("Sin fijos")).toBeInTheDocument();
    });

    it("muestra el copy de sección vacía para Cuotas", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.getByText("Sin cuotas")).toBeInTheDocument();
    });

    it("el pill contador muestra 0 en secciones vacías", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      // Todos los pills de contador deben mostrar "0"
      const pillsWithZero = screen.getAllByText("0");
      expect(pillsWithZero.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Fase 1.1.4 P5 — Acordeón: colapsar/expandir ──────────────────────────

  describe("Fase 1.1.4 P5 — Acordeón", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("existe el botón de disclosure con aria-expanded=true por defecto (sin preferencias)", () => {
      renderMonthView();

      // Los botones de disclosure tienen aria-expanded
      // (la cabecera de acordeón es el disclosure trigger)
      // Únicos debe estar expandido por defecto
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
    });

    it("colapsar una sección cambia aria-expanded a false", () => {
      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(unicosHeader);

      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");
    });

    it("volver a clickear expande la sección (aria-expanded=true)", () => {
      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);

      // Colapsar
      fireEvent.click(unicosHeader);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");

      // Expandir
      fireEvent.click(unicosHeader);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
    });

    it("colapsar persiste con setPreferences", async () => {
      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);
      fireEvent.click(unicosHeader);

      await waitFor(() => {
        expect(mockSetPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            monthSections: expect.objectContaining({
              collapsed: expect.arrayContaining(["unicos"]),
            }),
          }),
        );
      });
    });

    it("expandir persiste con setPreferences (quita la clave de collapsed)", async () => {
      // Simular que "unicos" está colapsada por preferencia previa
      mockUsePreferences.mockReturnValue({
        preferences: {
          monthSections: {
            order: ["unicos", "fijos", "cuotas"],
            collapsed: ["unicos"],
          },
        },
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);
      // Debe estar colapsada por preferencia → aria-expanded=false
      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");

      // Expandir
      fireEvent.click(unicosHeader);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");

      await waitFor(() => {
        expect(mockSetPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            monthSections: expect.objectContaining({
              collapsed: expect.not.arrayContaining(["unicos"]),
            }),
          }),
        );
      });
    });

    it("el botón de disclosure tiene aria-controls apuntando al body de la sección", () => {
      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);
      const controlledId = unicosHeader.getAttribute("aria-controls");
      expect(controlledId).toBeTruthy();
      // El body con ese id debe existir
      expect(document.getElementById(controlledId!)).toBeInTheDocument();
    });
  });

  // ── Fase 1.1.4 P5 — Preferencias: back-compat ────────────────────────────

  describe("Fase 1.1.4 P5 — Preferencias back-compat", () => {
    it("acepta monthSections sin definir (blob vacío) y muestra defaults", () => {
      mockLoaded(mockWithData);
      mockUsePreferences.mockReturnValue({
        preferences: {},
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      renderMonthView();

      // Las 3 secciones deben mostrarse en el orden default (unicos, fijos, cuotas)
      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /fijos/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /cuotas/i })).toBeInTheDocument();
    });

    it("respeta el estado colapsado guardado en preferencias", () => {
      mockLoaded(mockWithData);
      mockUsePreferences.mockReturnValue({
        preferences: {
          monthSections: {
            order: ["unicos", "fijos", "cuotas"],
            collapsed: ["fijos"],
          },
        },
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      renderMonthView();

      const fijosHeader = getDisclosureButton(/fijos/i);
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");

      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
    });
  });

  // ── Fase 1.1.4 P6 — Modo orden ───────────────────────────────────────────

  describe("Fase 1.1.4 P6 — Modo orden", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("existe el botón 'Ordenar secciones' fuera del modo orden", () => {
      renderMonthView();

      expect(screen.getByRole("button", { name: /ordenar secciones/i })).toBeInTheDocument();
    });

    it("al entrar al modo orden, el botón cambia a 'Listo'", () => {
      renderMonthView();

      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      expect(screen.getByRole("button", { name: /listo/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /ordenar secciones/i })).not.toBeInTheDocument();
    });

    it("al salir del modo orden (Listo), el botón vuelve a 'Ordenar secciones'", () => {
      renderMonthView();

      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      const listoBtn = screen.getByRole("button", { name: /listo/i });
      fireEvent.click(listoBtn);

      expect(screen.getByRole("button", { name: /ordenar secciones/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /listo/i })).not.toBeInTheDocument();
    });

    it("en modo orden, '+ Nuevo movimiento' está deshabilitado (pointer-events-none)", () => {
      renderMonthView();

      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      // El contenedor del NewTransactionButton tiene opacity-45 y pointer-events-none
      // Verificamos que el botón de nuevo movimiento exista pero que su wrapper esté atenuado
      const newMovBtn = screen.getByRole("button", { name: /nuevo movimiento/i });
      // Su ancestro tiene class opacity-45 pointer-events-none
      const wrapper = newMovBtn.closest(".opacity-45");
      expect(wrapper).toBeInTheDocument();
    });

    it("en modo orden las cabeceras de sección no colapsan al hacer click", () => {
      renderMonthView();

      // Entrar al modo orden
      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      // La cabecera de Únicos en modo orden no tiene onClick activo
      const unicosHeader = getDisclosureButton(/únicos/i);
      const ariaExpandedBefore = unicosHeader.getAttribute("aria-expanded");

      fireEvent.click(unicosHeader);

      // aria-expanded no debe cambiar (la cabecera no colapsa en modo orden)
      expect(unicosHeader).toHaveAttribute("aria-expanded", ariaExpandedBefore);
    });

    it("los handles GripVertical aparecen en modo orden", () => {
      renderMonthView();

      // Antes de modo orden no hay handles
      expect(screen.queryByLabelText("Arrastrar sección")).not.toBeInTheDocument();

      // Entrar al modo orden
      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      // Deben aparecer handles (uno por sección)
      const handles = screen.getAllByLabelText("Arrastrar sección");
      expect(handles.length).toBe(3);
    });

    // ── Fase 1.2.0 — colapso transitorio y restauración ─────────────────

    it("al entrar al modo orden todas las secciones se colapsan (aria-expanded=false)", () => {
      renderMonthView();

      // Sin preferencias, todas las secciones están expandidas por defecto
      const unicosHeader = getDisclosureButton(/únicos/i);
      const fijosHeader = getDisclosureButton(/fijos/i);
      const cuotasHeader = getDisclosureButton(/cuotas/i);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
      expect(fijosHeader).toHaveAttribute("aria-expanded", "true");
      expect(cuotasHeader).toHaveAttribute("aria-expanded", "true");

      // Entrar al modo orden
      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      // Todas deben quedar colapsadas (transitorio)
      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");
      expect(cuotasHeader).toHaveAttribute("aria-expanded", "false");
    });

    it("al salir del modo orden se restaura el estado de colapso previo", () => {
      renderMonthView();

      const unicosHeader = getDisclosureButton(/únicos/i);
      const fijosHeader = getDisclosureButton(/fijos/i);

      // Colapsar manualmente "fijos" antes de entrar al modo orden
      fireEvent.click(fijosHeader);
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");

      // Entrar al modo orden (todas colapsan)
      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");

      // Salir del modo orden (se restaura: únicos expandido, fijos colapsado)
      const listoBtn = screen.getByRole("button", { name: /listo/i });
      fireEvent.click(listoBtn);

      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");
    });

    it("salir del modo orden no persiste el colapso transitorio (no pisa las preferencias de colapso)", () => {
      renderMonthView();

      // Entrar y salir del modo orden sin haber colapsado nada antes
      const ordenarBtn = screen.getByRole("button", { name: /ordenar secciones/i });
      fireEvent.click(ordenarBtn);

      const listoBtn = screen.getByRole("button", { name: /listo/i });
      fireEvent.click(listoBtn);

      // mockSetPreferences no debe haber sido llamado por el flujo de modo orden
      // (el colapso transitorio es local, no persiste)
      // Nota: mockSetPreferences puede haber sido llamado por handleToggleCollapse
      // si el usuario colapsó secciones, pero no por handleEnterOrderMode ni handleExitOrderMode.
      // En este test no hubo toggle manual, así que no debe haberse llamado.
      expect(mockSetPreferences).not.toHaveBeenCalled();
    });
  });

  // ── Lista agrupada por origen — Únicos (RF-VM-001) ────────────────────────

  describe("Lista de movimientos — sección Únicos", () => {
    it("muestra la sección 'Únicos' con ítems cuando hay movimientos únicos", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
    });
  });

  // ── Lista agrupada por origen — Fijos (RF-VM-001, RF-MF-002) ─────────────

  describe("Lista de movimientos — sección Fijos (Fase 6)", () => {
    it("muestra el fijo con su descripción", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      expect(screen.getByText("Alquiler")).toBeInTheDocument();
    });

    it("muestra el badge 'Fijo' en el ítem de origen fijo", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      const fijoSection = screen.getByRole("region", { name: /fijos/i });
      expect(fijoSection).toHaveTextContent(/fijo/i);
    });

    it("muestra 'Mensual' en lugar de fecha/hora para fijos (occurredAt=null)", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      const fijoSection = screen.getByRole("region", { name: /fijos/i });
      expect(fijoSection).toHaveTextContent(/mensual/i);
    });
  });

  // ── Lista agrupada por origen — Cuotas (RF-VM-001, RF-MC-001) ─────────────

  describe("Lista de movimientos — sección Cuotas (Fase 7)", () => {
    it("muestra el ítem de cuota con su descripción", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      expect(screen.getByText("Notebook")).toBeInTheDocument();
    });

    it("muestra el badge 'Cuotas' en el ítem de origen cuota", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      const cuotaSection = screen.getByRole("region", { name: /cuotas/i });
      expect(cuotaSection).toHaveTextContent(/cuotas/i);
    });

    it("muestra 'Cuota X/N' (3/12) para la cuota del mes", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      expect(screen.getByText(/cuota 3\/12/i)).toBeInTheDocument();
    });

    it("NO muestra fecha/hora para cuotas (occurredAt=null)", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      const cuotaSection = screen.getByRole("region", { name: /cuotas/i });
      expect(cuotaSection).not.toHaveTextContent("Mensual");
    });
  });

  // ── Estado de error ───────────────────────────────────────────────────────

  describe("Estado de error", () => {
    it("muestra mensaje de error sin romper la pantalla", () => {
      mockUseMovements.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isPending: false,
        isSuccess: false,
        error: new Error("Network error"),
        status: "error",
        fetchStatus: "idle",
      } as ReturnType<typeof useMovements>);

      renderMonthView();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo cargar/i);
    });
  });

  // ── Cableado editar/eliminar — Únicos ─────────────────────────────────────

  describe("Cableado editar/eliminar — Únicos", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("click en Editar de único abre el modal de edición (TransactionModal mode=edit-single)", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de almuerzo en el trabajo/i });
      fireEvent.click(trigger);

      const editItem = screen.getByRole("menuitem", { name: /editar/i });
      fireEvent.click(editItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar movimiento/i)).toBeInTheDocument();
    });

    it("click en Eliminar de único abre el diálogo de eliminación (DeleteTransactionDialog)", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de almuerzo en el trabajo/i });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const title = screen.getByRole("heading", { name: /eliminar movimiento/i });
      expect(title).toBeInTheDocument();
      expect(title.textContent).not.toMatch(/fijo/i);
    });

    it("cerrar el modal de edición lo quita del DOM", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de almuerzo en el trabajo/i });
      fireEvent.click(trigger);

      const editItem = screen.getByRole("menuitem", { name: /editar/i });
      fireEvent.click(editItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: /cerrar/i });
      fireEvent.click(closeButton);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── Cableado editar/eliminar — Fijos (Fase 6) ─────────────────────────────

  describe("Cableado editar/eliminar — Fijos", () => {
    beforeEach(() => {
      mockLoaded(mockWithFijos);
    });

    it("click en Editar de fijo abre el modal de edición de fijo (mode=edit-fixed)", () => {
      renderMonthView();

      const fijoSection = screen.getByRole("region", { name: /fijos/i });
      expect(fijoSection).toBeInTheDocument();

      const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
      fireEvent.click(trigger);

      const editItem = screen.getByRole("menuitem", { name: /editar/i });
      fireEvent.click(editItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
    });

    it("click en Eliminar de fijo abre el DeleteRecurringDialog", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /eliminar movimiento fijo/i })).toBeInTheDocument();

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getByText(/desde este mes en adelante/i)).toBeInTheDocument();
    });
  });

  // ── Cableado editar/eliminar — Cuotas (Fase 7) ───────────────────────────────

  describe("Cableado editar/eliminar — Cuotas", () => {
    beforeEach(() => {
      mockLoaded(mockWithCuotas);
    });

    it("click en Editar de cuota abre el modal de edición de cuota (mode=edit-installment)", () => {
      renderMonthView();

      const cuotaSection = screen.getByRole("region", { name: /cuotas/i });
      expect(cuotaSection).toBeInTheDocument();

      const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
      fireEvent.click(trigger);

      const editItem = screen.getByRole("menuitem", { name: /editar/i });
      fireEvent.click(editItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
    });

    it("click en Eliminar de cuota abre el DeleteInstallmentDialog (sin checkbox)", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /eliminar grupo de cuotas/i }),
      ).toBeInTheDocument();

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("el DeleteInstallmentDialog advierte que se elimina el grupo completo", () => {
      renderMonthView();

      const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByText(/grupo completo/i)).toBeInTheDocument();
    });
  });

  // ── Estado de carga ───────────────────────────────────────────────────────

  describe("Estado de carga", () => {
    it("muestra el indicador de carga mientras obtiene datos", () => {
      mockUseMovements.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isPending: true,
        isSuccess: false,
        error: null,
        status: "pending",
        fetchStatus: "fetching",
      } as ReturnType<typeof useMovements>);

      renderMonthView();

      expect(screen.getByLabelText("Cargando totales")).toBeInTheDocument();
    });
  });

  // ── Enrutamiento de borrado de calculados por sourceType (Fase 1.1.8) ────────

  describe("Enrutamiento de borrado de calculados por sourceType", () => {
    it("calculado de fijo → abre DeleteRecurringDialog con título 'Eliminar movimiento fijo'", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 150000, incomeCents: 0, balanceCents: -150000 },
        movements: {
          unicos: [],
          fijos: [mockCalculatedDeFijo],
          cuotas: [],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de alquiler/i,
      });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /eliminar movimiento fijo/i }),
      ).toBeInTheDocument();
    });

    it("calculado de fijo → el diálogo muestra copy de recurrencia ('desde este mes en adelante')", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 150000, incomeCents: 0, balanceCents: -150000 },
        movements: {
          unicos: [],
          fijos: [mockCalculatedDeFijo],
          cuotas: [],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de alquiler/i,
      });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));

      expect(screen.getByText(/desde este mes en adelante/i)).toBeInTheDocument();
    });

    it("calculado de único → abre confirmación directa con título 'Eliminar movimiento calculado'", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 0, balanceCents: -15000 },
        movements: {
          unicos: [mockCalculatedDeUnico],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de almuerzo/i,
      });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /eliminar movimiento calculado/i }),
      ).toBeInTheDocument();
    });

    it("calculado de único → NO muestra copy de recurrencia ('desde este mes en adelante')", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 0, balanceCents: -15000 },
        movements: {
          unicos: [mockCalculatedDeUnico],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de almuerzo/i,
      });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));

      expect(screen.queryByText(/desde este mes en adelante/i)).not.toBeInTheDocument();
    });

    it("calculado de cuota → abre confirmación directa con título 'Eliminar movimiento calculado'", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 50000, incomeCents: 0, balanceCents: -50000 },
        movements: {
          unicos: [],
          fijos: [],
          cuotas: [mockCalculatedDeCuota],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de cuota notebook/i,
      });
      fireEvent.click(trigger);

      const deleteItem = screen.getByRole("menuitem", { name: /eliminar/i });
      fireEvent.click(deleteItem);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /eliminar movimiento calculado/i }),
      ).toBeInTheDocument();
    });

    it("calculado de cuota → NO muestra copy de recurrencia ('desde este mes en adelante')", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 50000, incomeCents: 0, balanceCents: -50000 },
        movements: {
          unicos: [],
          fijos: [],
          cuotas: [mockCalculatedDeCuota],
        },
      });
      renderMonthView();

      const trigger = screen.getByRole("button", {
        name: /acciones de calculado de cuota notebook/i,
      });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));

      expect(screen.queryByText(/desde este mes en adelante/i)).not.toBeInTheDocument();
    });
  });

  // ── Fase 1.2.1 — Filtros por sección ─────────────────────────────────────

  describe("Fase 1.2.1 — Filtros por sección", () => {
    // ── useMovements se llama SIN filtro de backend ────────────────────────

    it("useMovements se llama con solo el mes (sin segundo parámetro de categorías)", () => {
      mockLoaded(mockWithData);
      renderMonthView("2026-06");

      // Sin segundo parámetro = null (todas las categorías, sin filtro de backend)
      expect(mockUseMovements).toHaveBeenCalledWith("2026-06");
    });

    it("NO hay botón 'Filtrar categorías' en el header (fue eliminado en Fase 1.2.1)", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      // El viejo FilterButton con label "Filtrar categorías" ya no existe en el header
      // Ahora hay SectionFilterButton por sección con label "Filtrar Únicos/Fijos/Cuotas"
      const filterBtns = screen.queryAllByRole("button", { name: /^filtrar categorías$/i });
      expect(filterBtns).toHaveLength(0);
    });

    // ── Disparadores de filtro por sección ────────────────────────────────

    it("hay un botón de filtro por cada sección (Filtrar Únicos, Fijos, Cuotas)", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      expect(screen.getByRole("button", { name: /filtrar únicos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /filtrar fijos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /filtrar cuotas/i })).toBeInTheDocument();
    });

    it("el disparador tiene aria-expanded=false por defecto (cerrado)", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      expect(filterBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("al hacer click en el disparador, aria-expanded pasa a true", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      expect(filterBtn).toHaveAttribute("aria-expanded", "true");
    });

    it("al volver a clickear el disparador, se cierra (aria-expanded=false)", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);
      expect(filterBtn).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(filterBtn);
      expect(filterBtn).toHaveAttribute("aria-expanded", "false");
    });

    // ── Default fresco — Ambos + todas ────────────────────────────────────

    it("sin preferencias: las 3 secciones muestran todos sus ítems (Ambos + todas, sin filtro)", () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Ambos ítems de Únicos deben verse
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
      // El ítem de ingreso (sin description) se identifica por la sección
      const unicosSection = screen.getByRole("region", { name: /únicos/i });
      expect(unicosSection).toBeInTheDocument();
    });

    // ── Filtro de tipo: EXPENSE filtra los ítems ──────────────────────────

    it("filtro de tipo EXPENSE en Únicos: solo muestra gastos", async () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Abrir el popover de filtros de Únicos
      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      // El popover debe abrirse — hay un radiogroup "Tipo de movimiento"
      await waitFor(() => {
        expect(screen.getByRole("radiogroup", { name: /tipo de movimiento/i })).toBeInTheDocument();
      });

      // Seleccionar "Gasto"
      const gastoRadio = screen.getByRole("radio", { name: /gasto/i });
      fireEvent.click(gastoRadio);

      // El gasto debe seguir visible
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();

      // El ingreso (mockMovementIncome) no tiene descripción — verificamos por el pill del contador
      // El contador de Únicos debe mostrar 1 (solo el gasto)
      // El pill está dentro del <button> de disclosure
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveTextContent("1");
    });

    it("filtro de tipo INCOME en Únicos: solo muestra ingresos", async () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Abrir el popover de filtros de Únicos
      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      await waitFor(() => {
        expect(screen.getByRole("radiogroup", { name: /tipo de movimiento/i })).toBeInTheDocument();
      });

      // Seleccionar "Ingreso"
      const ingresoRadio = screen.getByRole("radio", { name: /ingreso/i });
      fireEvent.click(ingresoRadio);

      // El gasto ya no debe verse
      expect(screen.queryByText("Almuerzo en el trabajo")).not.toBeInTheDocument();

      // El contador de Únicos debe mostrar 1 (solo el ingreso)
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveTextContent("1");
    });

    it("filtro ALL (Ambos) muestra todos los ítems de la sección", async () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Abrir el popover y seleccionar "Ambos" (ya debería estar seleccionado por default)
      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      await waitFor(() => {
        expect(screen.getByRole("radiogroup", { name: /tipo de movimiento/i })).toBeInTheDocument();
      });

      const ambosRadio = screen.getByRole("radio", { name: /ambos/i });
      expect(ambosRadio).toHaveAttribute("aria-checked", "true");

      // Ambos ítems visibles
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveTextContent("2");
    });

    // ── Totales recalculados desde lo visible ─────────────────────────────

    it("al filtrar por EXPENSE en Únicos, los totales se recalculan (solo gastos visibles)", async () => {
      // Únicos: 1 gasto ($150) + 1 ingreso ($5000)
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Antes de filtrar: Gastos $150, Ingresos $5000, Balance +$4850
      expect(screen.getByText("$150,00")).toBeInTheDocument();
      expect(screen.getByText("$5.000,00")).toBeInTheDocument();

      // Filtrar por EXPENSE
      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);
      await waitFor(() => {
        expect(screen.getByRole("radiogroup", { name: /tipo de movimiento/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("radio", { name: /gasto/i }));

      // Después de filtrar: solo el gasto ($150), ingreso = 0 → balance = -$150
      // Gastos visibles: $150 (solo el gasto de Únicos)
      expect(screen.getByText("$150,00")).toBeInTheDocument();
      // Ingresos visibles: $0 (el ingreso se filtró).
      // Nota: $0,00 puede aparecer múltiples veces (tarjeta de ingresos + subtotales de secciones).
      // Verificamos que al menos una tarjeta de ingresos muestre $0,00.
      const zeroTexts = screen.getAllByText("$0,00");
      expect(zeroTexts.length).toBeGreaterThanOrEqual(1);
    });

    // ── Filtro de categoría por sección ───────────────────────────────────

    it("filtro de categoría en Únicos: al filtrar por cat-1, solo se ve el gasto de Alimentación", async () => {
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Abrir popover de Únicos
      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      await waitFor(() => {
        // La lista de categorías debe estar visible
        expect(screen.getByRole("button", { name: /ninguna/i })).toBeInTheDocument();
      });

      // Deseleccionar todas → clic en "Ninguna"
      fireEvent.click(screen.getByRole("button", { name: /ninguna/i }));

      // Contador de Únicos debe ser 0 (ninguna categoría seleccionada = sin ítems)
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveTextContent("0");

      // No debe mostrarse el gasto
      expect(screen.queryByText("Almuerzo en el trabajo")).not.toBeInTheDocument();
    });

    // ── Persistencia ──────────────────────────────────────────────────────

    it("cambiar el tipo de Únicos persiste en setPreferences (monthListFilters)", async () => {
      mockLoaded(mockWithData);
      renderMonthView();

      const filterBtn = screen.getByRole("button", { name: /filtrar únicos/i });
      fireEvent.click(filterBtn);

      await waitFor(() => {
        expect(screen.getByRole("radiogroup", { name: /tipo de movimiento/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("radio", { name: /gasto/i }));

      await waitFor(() => {
        expect(mockSetPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            monthListFilters: expect.objectContaining({
              unicos: expect.objectContaining({ type: "EXPENSE" }),
            }),
          }),
        );
      });
    });

    it("lee monthListFilters desde preferencias al montar (default de sección)", () => {
      mockUsePreferences.mockReturnValue({
        preferences: {
          monthListFilters: {
            unicos: { type: "EXPENSE", categories: null },
            fijos: { type: "ALL", categories: null },
            cuotas: { type: "ALL", categories: null },
          },
        },
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      // Datos con gasto e ingreso en Únicos
      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // Con type=EXPENSE guardado, el ingreso no debe verse
      expect(screen.queryByText("Almuerzo en el trabajo")).toBeInTheDocument();

      // El contador de Únicos debe ser 1 (solo el gasto)
      const unicosHeader = getDisclosureButton(/únicos/i);
      expect(unicosHeader).toHaveTextContent("1");
    });

    // ── Modo orden — el disparador no se renderiza ─────────────────────────

    it("en modo orden, los disparadores de filtro de sección NO se muestran", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      // Fuera del modo orden, los disparadores están presentes
      expect(screen.getByRole("button", { name: /filtrar únicos/i })).toBeInTheDocument();

      // Entrar al modo orden
      fireEvent.click(screen.getByRole("button", { name: /ordenar secciones/i }));

      // Los disparadores de filtro no deben estar (AccordionSection los oculta en isOrderMode)
      expect(screen.queryByRole("button", { name: /filtrar únicos/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /filtrar fijos/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /filtrar cuotas/i })).not.toBeInTheDocument();
    });

    it("al salir del modo orden, los disparadores de filtro vuelven", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      // Entrar y salir del modo orden
      fireEvent.click(screen.getByRole("button", { name: /ordenar secciones/i }));
      fireEvent.click(screen.getByRole("button", { name: /listo/i }));

      // Los disparadores deben estar de vuelta
      expect(screen.getByRole("button", { name: /filtrar únicos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /filtrar fijos/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /filtrar cuotas/i })).toBeInTheDocument();
    });

    // ── monthCategoryFilter ya no se usa ──────────────────────────────────

    it("ignora monthCategoryFilter de las preferencias (ya no se lee en Fase 1.2.1)", () => {
      // Preferencias antiguas con monthCategoryFilter — no deben afectar el comportamiento
      mockUsePreferences.mockReturnValue({
        preferences: {
          monthCategoryFilter: ["cat-1"], // valor de la fase anterior
        },
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });
      renderMonthView();

      // useMovements debe llamarse SIN el filtro de categoryIds del viejo filtro por pantalla
      expect(mockUseMovements).toHaveBeenCalledWith("2026-06");

      // Ambos ítems deben ser visibles (el monthCategoryFilter viejo no filtra)
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
    });

    it("back-compat: monthListFilters ausente en prefs → default (Ambos + todas) sin crash", () => {
      mockUsePreferences.mockReturnValue({
        preferences: {}, // sin monthListFilters
        setPreferences: mockSetPreferences,
        isSaving: false,
        isLoading: false,
        isError: false,
        error: null,
      } as ReturnType<typeof usePreferences>);

      mockLoaded({
        month: "2026-06",
        totals: { expenseCents: 15000, incomeCents: 500000, balanceCents: 485000 },
        movements: {
          unicos: [mockMovementExpense, mockMovementIncome],
          fijos: [],
          cuotas: [],
        },
      });

      // No debe crashear, y todos los ítems deben verse
      expect(() => renderMonthView()).not.toThrow();
      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
    });
  });
});

// ─── Chip de moneda default en /mes (Fase 1.2.3-ext) ─────────────────────────

describe("MonthViewClient — chip de moneda default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Preferencias sin filtros previos
    mockUsePreferences.mockReturnValue({
      preferences: {},
      setPreferences: mockSetPreferences,
      isSaving: false,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePreferences>);
  });

  function mockEmpty() {
    mockUseMovements.mockReturnValue({
      data: {
        month: "2026-06",
        totals: { expenseCents: 0, incomeCents: 0, balanceCents: 0 },
        movements: { unicos: [], fijos: [], cuotas: [] },
      },
      isLoading: false,
      isError: false,
      isPending: false,
      isSuccess: true,
      error: null,
      status: "success",
      fetchStatus: "idle",
    } as ReturnType<typeof useMovements>);
  }

  it("el chip de moneda aparece en el header de /mes (ARS por defecto)", () => {
    mockEmpty();
    renderMonthView();
    // El chip está presente en el header — puede haber uno en desktop y uno en mobile
    const chips = screen.getAllByRole("link", { name: /moneda por defecto: ARS/i });
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });

  it("el chip de /mes es un link a /configuracion", () => {
    mockEmpty();
    renderMonthView();
    const chips = screen.getAllByRole("link", { name: /moneda por defecto: ARS/i });
    chips.forEach((chip) => expect(chip).toHaveAttribute("href", "/configuracion"));
  });

  it("el chip de /mes muestra el código de moneda 'ARS'", () => {
    mockEmpty();
    renderMonthView();
    const chips = screen.getAllByRole("link", { name: /moneda por defecto: ARS/i });
    chips.forEach((chip) => expect(chip).toHaveTextContent("ARS"));
  });
});
