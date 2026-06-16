/**
 * Tests del MonthViewClient (RF-VM-001/002/003/004).
 *
 * Fase 1.1.4 (2026-06-16): acordeón + reordenar secciones.
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
 * - Cableado editar/eliminar: únicos → modal único / delete único
 * - Cableado editar/eliminar: fijos → modal fijo / delete fijo (Fase 6)
 * - Cableado editar/eliminar: cuotas → modal cuota / delete cuota (Fase 7)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string) => ["movements", month],
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

vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [],
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
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
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
      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
    });

    it("colapsar una sección cambia aria-expanded a false", () => {
      renderMonthView();

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(unicosHeader);

      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");
    });

    it("volver a clickear expande la sección (aria-expanded=true)", () => {
      renderMonthView();

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });

      // Colapsar
      fireEvent.click(unicosHeader);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "false");

      // Expandir
      fireEvent.click(unicosHeader);
      expect(unicosHeader).toHaveAttribute("aria-expanded", "true");
    });

    it("colapsar persiste con setPreferences", async () => {
      renderMonthView();

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
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

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
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

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
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

      const fijosHeader = screen.getByRole("button", { name: /fijos/i });
      expect(fijosHeader).toHaveAttribute("aria-expanded", "false");

      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
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
      const unicosHeader = screen.getByRole("button", { name: /únicos/i });
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
});
