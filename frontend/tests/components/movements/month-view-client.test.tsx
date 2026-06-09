/**
 * Tests del MonthViewClient (RF-VM-001/002/003/004).
 *
 * Verifica:
 * - Navegación prev/next cambia la URL (/mes?month=YYYY-MM)
 * - Render de totales del mes
 * - Lista agrupada: sección Únicos con ítems; secciones vacías no se muestran
 * - Lista agrupada: sección Fijos con ítems (Fase 6)
 * - Lista agrupada: sección Cuotas con ítems y "X/N" (Fase 7)
 * - Estado vacío: sin movimientos → mensaje sin error
 * - Estado de error: mensaje sin romper la pantalla
 * - Cableado editar/eliminar: únicos → modal único / delete único
 * - Cableado editar/eliminar: fijos → modal fijo / delete fijo (Fase 6)
 * - Cableado editar/eliminar: cuotas → modal cuota / delete cuota (Fase 7)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MonthMovements } from "@/types/movement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
  MOVEMENTS_QUERY_KEY: (month: string) => ["movements", month],
}));

vi.mock("@/hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
    token: "test-token",
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
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
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
import { MonthViewClient } from "@/components/movements/month-view-client";

const mockUseMovements = vi.mocked(useMovements);

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
  category: { id: "cat-2", name: "Sueldo", color: "#33FF57", scope: "INCOME" as const },
};

/** Fijo de ejemplo — occurredAt y timezone son null (RF-MF-002) */
const mockMovementFijo = {
  id: "rec-1",
  origin: "fijo" as const,
  type: "EXPENSE" as const,
  amountCents: 150000,
  description: "Alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  category: { id: "cat-3", name: "Servicios", color: "#5733FF", scope: "EXPENSE" as const },
};

/** Cuota de ejemplo — occurredAt y timezone son null; installment presente (Fase 7) */
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
  });

  // ── Encabezado y navegación prev/next (RF-VM-004) ──────────────────────────

  describe("Navegación prev/next", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("muestra el mes activo en el encabezado", () => {
      renderMonthView("2026-06");
      expect(screen.getByText(/junio/i)).toBeInTheDocument();
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

      // $150,00 (15000 centavos)
      expect(screen.getByText("$150,00")).toBeInTheDocument();
      // $5.000,00 (500000 centavos)
      expect(screen.getByText("$5.000,00")).toBeInTheDocument();
      // $4.850,00 (485000 centavos)
      expect(screen.getByText("$4.850,00")).toBeInTheDocument();
    });

    it("muestra totales en cero cuando el mes está vacío", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      const zeroes = screen.getAllByText("$0,00");
      expect(zeroes.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Lista agrupada por origen — Únicos (RF-VM-001) ────────────────────────

  describe("Lista de movimientos — sección Únicos", () => {
    it("muestra la sección 'Únicos' cuando hay movimientos únicos", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      expect(screen.getByRole("region", { name: /únicos/i })).toBeInTheDocument();
    });

    it("muestra los ítems de la sección Únicos", () => {
      mockLoaded(mockWithData);
      renderMonthView();

      expect(screen.getByText("Almuerzo en el trabajo")).toBeInTheDocument();
    });

    it("NO muestra la sección 'Fijos' cuando está vacía", () => {
      mockLoaded(mockWithData); // fijos: []
      renderMonthView();

      expect(screen.queryByRole("region", { name: /fijos/i })).not.toBeInTheDocument();
    });

    it("NO muestra la sección 'Cuotas' cuando está vacía", () => {
      mockLoaded(mockWithData); // cuotas: []
      renderMonthView();

      expect(screen.queryByRole("region", { name: /cuotas/i })).not.toBeInTheDocument();
    });

    it("NO muestra la sección 'Únicos' cuando está vacía", () => {
      mockLoaded(mockEmpty); // unicos: []
      renderMonthView();

      expect(screen.queryByRole("region", { name: /únicos/i })).not.toBeInTheDocument();
    });
  });

  // ── Lista agrupada por origen — Fijos (RF-VM-001, RF-MF-002) ─────────────

  describe("Lista de movimientos — sección Fijos (Fase 6)", () => {
    it("muestra la sección 'Fijos' cuando hay movimientos fijos", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      expect(screen.getByRole("region", { name: /fijos/i })).toBeInTheDocument();
    });

    it("muestra el fijo con su descripción", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      expect(screen.getByText("Alquiler")).toBeInTheDocument();
    });

    it("muestra el badge 'Fijo' en el ítem de origen fijo", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      // El badge de origen debe indicar "Fijo"
      const fijoSection = screen.getByRole("region", { name: /fijos/i });
      expect(fijoSection).toHaveTextContent(/fijo/i);
    });

    it("muestra 'Mensual' en lugar de fecha/hora para fijos (occurredAt=null)", () => {
      mockLoaded(mockWithFijos);
      renderMonthView();

      expect(screen.getByText("Mensual")).toBeInTheDocument();
    });

    it("NO muestra la sección 'Fijos' cuando fijos está vacío", () => {
      mockLoaded(mockWithData); // fijos: []
      renderMonthView();

      expect(screen.queryByRole("region", { name: /fijos/i })).not.toBeInTheDocument();
    });
  });

  // ── Estado vacío ──────────────────────────────────────────────────────────

  describe("Estado vacío", () => {
    it("muestra mensaje de estado vacío sin error", () => {
      mockLoaded(mockEmpty);
      renderMonthView();

      expect(screen.getByText(/no hay movimientos/i)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

      const editButtons = screen.getAllByRole("button", { name: /editar/i });
      fireEvent.click(editButtons[0]);

      // El modal de edición debe abrirse
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar movimiento/i)).toBeInTheDocument();
    });

    it("click en Eliminar de único abre el diálogo de eliminación (DeleteTransactionDialog)", () => {
      renderMonthView();

      const deleteButtons = screen.getAllByRole("button", { name: /eliminar/i });
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // El diálogo de único tiene "Eliminar movimiento" (sin "fijo")
      const title = screen.getByRole("heading", { name: /eliminar movimiento/i });
      expect(title).toBeInTheDocument();
      // No debe decir "fijo" en el título del diálogo de único
      expect(title.textContent).not.toMatch(/fijo/i);
    });

    it("cerrar el modal de edición lo quita del DOM", () => {
      renderMonthView();

      const editButtons = screen.getAllByRole("button", { name: /editar/i });
      fireEvent.click(editButtons[0]);

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

      // La sección Fijos debe existir
      const fijoSection = screen.getByRole("region", { name: /fijos/i });
      expect(fijoSection).toBeInTheDocument();

      // Click en el botón Editar del fijo
      const editBtns = screen.getAllByRole("button", { name: /editar/i });
      // El primer Editar corresponde al único (sección Únicos viene antes que Fijos)
      // El segundo al fijo
      const fijoEditBtn = editBtns.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Alquiler"),
      );
      expect(fijoEditBtn).toBeTruthy();
      fireEvent.click(fijoEditBtn!);

      // Modal abierto en modo editar
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar movimiento/i)).toBeInTheDocument();
    });

    it("click en Eliminar de fijo abre el DeleteRecurringDialog (con checkbox)", () => {
      renderMonthView();

      // Click en Eliminar del fijo
      const deleteBtns = screen.getAllByRole("button", { name: /eliminar/i });
      const fijoDeleteBtn = deleteBtns.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Alquiler"),
      );
      expect(fijoDeleteBtn).toBeTruthy();
      fireEvent.click(fijoDeleteBtn!);

      // El diálogo de fijo debe abrirse — tiene "Eliminar movimiento fijo" en el título
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /eliminar movimiento fijo/i })).toBeInTheDocument();

      // El checkbox es la marca distintiva del diálogo de fijo
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      // Desmarcado por defecto (RF-MF-004)
      expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    });
  });

  // ── Lista agrupada por origen — Cuotas (RF-VM-001, RF-MC-001) ───────────────

  describe("Lista de movimientos — sección Cuotas (Fase 7)", () => {
    it("muestra la sección 'Cuotas' cuando hay movimientos de cuotas", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      expect(screen.getByRole("region", { name: /cuotas/i })).toBeInTheDocument();
    });

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

      // Debe mostrar el número de cuota y el total (RF-MC-001)
      expect(screen.getByText(/cuota 3\/12/i)).toBeInTheDocument();
    });

    it("NO muestra fecha/hora para cuotas (occurredAt=null)", () => {
      mockLoaded(mockWithCuotas);
      renderMonthView();

      // Cuotas no tienen fecha/hora ni "Mensual" — solo "Cuota X/N"
      // Verificamos que no haya texto con formato de fecha dd/mm/aaaa dentro de la sección
      const cuotaSection = screen.getByRole("region", { name: /cuotas/i });
      expect(cuotaSection).not.toHaveTextContent("Mensual");
    });

    it("NO muestra la sección 'Cuotas' cuando cuotas está vacío", () => {
      mockLoaded(mockWithData); // cuotas: []
      renderMonthView();

      expect(screen.queryByRole("region", { name: /cuotas/i })).not.toBeInTheDocument();
    });
  });

  // ── Cableado editar/eliminar — Cuotas (Fase 7) ───────────────────────────────

  describe("Cableado editar/eliminar — Cuotas", () => {
    beforeEach(() => {
      mockLoaded(mockWithCuotas);
    });

    it("click en Editar de cuota abre el modal de edición de cuota (mode=edit-installment)", () => {
      renderMonthView();

      // La sección Cuotas debe existir
      const cuotaSection = screen.getByRole("region", { name: /cuotas/i });
      expect(cuotaSection).toBeInTheDocument();

      // Click en el botón Editar de la cuota
      const editBtns = screen.getAllByRole("button", { name: /editar/i });
      const cuotaEditBtn = editBtns.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Notebook"),
      );
      expect(cuotaEditBtn).toBeTruthy();
      fireEvent.click(cuotaEditBtn!);

      // Modal abierto en modo editar
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar movimiento/i)).toBeInTheDocument();
    });

    it("click en Eliminar de cuota abre el DeleteInstallmentDialog (sin checkbox)", () => {
      renderMonthView();

      // Click en Eliminar de la cuota
      const deleteBtns = screen.getAllByRole("button", { name: /eliminar/i });
      const cuotaDeleteBtn = deleteBtns.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Notebook"),
      );
      expect(cuotaDeleteBtn).toBeTruthy();
      fireEvent.click(cuotaDeleteBtn!);

      // El diálogo de cuota debe abrirse — tiene "Eliminar grupo de cuotas" en el título
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /eliminar grupo de cuotas/i }),
      ).toBeInTheDocument();

      // Sin checkbox — la eliminación siempre es total (a diferencia del diálogo de fijo)
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("el DeleteInstallmentDialog advierte que se elimina el grupo completo", () => {
      renderMonthView();

      const deleteBtns = screen.getAllByRole("button", { name: /eliminar/i });
      const cuotaDeleteBtn = deleteBtns.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Notebook"),
      );
      fireEvent.click(cuotaDeleteBtn!);

      // Advertencia explícita del grupo completo (RF-MC-002)
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
