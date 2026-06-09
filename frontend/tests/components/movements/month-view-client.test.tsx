/**
 * Tests del MonthViewClient (RF-VM-001/002/003/004).
 *
 * Verifica:
 * - Navegación prev/next cambia la URL (/mes?month=YYYY-MM)
 * - Render de totales del mes
 * - Lista agrupada: sección Únicos con ítems; secciones vacías no se muestran
 * - Estado vacío: sin movimientos → mensaje sin error
 * - Estado de error: mensaje sin romper la pantalla
 * - Cableado editar/eliminar: abren los modales con el ítem correcto
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
  category: { id: "cat-2", name: "Sueldo", color: "#33FF57", scope: "INCOME" as const },
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

  // ── Lista agrupada por origen (RF-VM-001) ─────────────────────────────────

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

  // ── Cableado editar/eliminar ───────────────────────────────────────────────

  describe("Cableado editar/eliminar", () => {
    beforeEach(() => {
      mockLoaded(mockWithData);
    });

    it("hace click en Editar abre el modal de edición con el movimiento correcto", () => {
      renderMonthView();

      // Debe haber botones de editar (uno por movimiento)
      const editButtons = screen.getAllByRole("button", { name: /editar/i });
      expect(editButtons.length).toBeGreaterThan(0);

      // Click en el primero
      fireEvent.click(editButtons[0]);

      // El modal de edición debe abrirse — busca el título del modal
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/editar movimiento/i)).toBeInTheDocument();
    });

    it("hace click en Eliminar abre el diálogo de confirmación", () => {
      renderMonthView();

      const deleteButtons = screen.getAllByRole("button", { name: /eliminar/i });
      // Filtrar solo los de "Eliminar" de la fila (no el del diálogo)
      const rowDeleteButton = deleteButtons[0];

      fireEvent.click(rowDeleteButton);

      // El diálogo de eliminación debe abrirse
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/eliminar movimiento/i)).toBeInTheDocument();
    });

    it("cerrar el modal de edición lo quita del DOM", () => {
      renderMonthView();

      const editButtons = screen.getAllByRole("button", { name: /editar/i });
      fireEvent.click(editButtons[0]);

      // Modal abierto
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Cerrar
      const closeButton = screen.getByRole("button", { name: /cerrar/i });
      fireEvent.click(closeButton);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
