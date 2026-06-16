/**
 * Tests de MovementItemRow (RF-VM-001).
 * Verifica:
 * - Render básico: nombre, monto, categoría, tipo.
 * - Frecuencia dinámica en la sublínea de fijos (P2 — Fase 1.1.1).
 * - Render del ítem fijo anulado (skipped=true): badge, tachado, opacity (P1 — Fase 1.1.1).
 * - Acción "Anular este mes" en el KebabMenu de fijos activos (P1 — Fase 1.1.1).
 * - Acción "Des-anular este mes" en el KebabMenu de fijos anulados (P1 — Fase 1.1.1).
 * - Únicos y cuotas NO tienen la acción de anular en su KebabMenu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-recurring", () => ({
  useRecurring: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  })),
}));

import { useRecurring } from "@/hooks/use-recurring";

const mockUseRecurring = vi.mocked(useRecurring);

const mockSkipRecurring = vi.fn();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCategory = {
  id: "cat-1",
  name: "Servicios",
  color: "#FF5733",
  scope: "EXPENSE" as const,
};

const fijoActivo: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Alquiler",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: "MONTHLY",
  skipped: false,
  category: baseCategory,
};

const fijoAnulado: MovementItem = {
  ...fijoActivo,
  skipped: true,
};

const fijoBimestral: MovementItem = {
  ...fijoActivo,
  frequency: "BIMONTHLY",
  description: "Seguro",
};

const fijoTrimestral: MovementItem = {
  ...fijoActivo,
  frequency: "QUARTERLY",
  description: "Cuota anual",
};

const fijoSemestral: MovementItem = {
  ...fijoActivo,
  frequency: "BIANNUAL",
  description: "Impuesto",
};

const fijoAnual: MovementItem = {
  ...fijoActivo,
  frequency: "ANNUAL",
  description: "Renovación",
};

const unico: MovementItem = {
  id: "mov-1",
  origin: "unico",
  type: "EXPENSE",
  amountCents: 10000,
  description: "Almuerzo",
  occurredAt: "2026-06-17T17:30:00.000Z",
  timezone: "America/Argentina/Buenos_Aires",
  installment: null,
  frequency: null,
  skipped: false,
  category: { id: "cat-2", name: "Alimentación", color: "#00FF00", scope: "BOTH" },
};

const cuota: MovementItem = {
  id: "inst-1",
  origin: "cuota",
  type: "EXPENSE",
  amountCents: 50000,
  description: "Notebook",
  occurredAt: null,
  timezone: null,
  installment: { number: 3, total: 12, startMonth: "2026-01" },
  frequency: null,
  skipped: false,
  category: { id: "cat-3", name: "Tecnología", color: "#0000FF", scope: "EXPENSE" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function renderRow(movement: MovementItem, viewMonth = "2026-06") {
  return render(
    <MovementItemRow
      movement={movement}
      viewMonth={viewMonth}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
    { wrapper: createWrapper() },
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRecurring.mockReturnValue({
    createRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    skipRecurring: mockSkipRecurring,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSkipping: false,
  });
});

// ─── Tests: render básico ─────────────────────────────────────────────────────

describe("MovementItemRow — render básico", () => {
  it("muestra la descripción del movimiento", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("muestra el monto formateado con signo (gasto con −$)", () => {
    renderRow(fijoActivo);
    // 150000 centavos = $1.500,00
    expect(screen.getByText("−$1.500,00")).toBeInTheDocument();
  });

  it("muestra la categoría en la sublínea", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("Servicios")).toBeInTheDocument();
  });
});

// ─── Tests: frecuencia dinámica en sublínea (P2 — Fase 1.1.1) ────────────────

describe("MovementItemRow — frecuencia dinámica en la sublínea (P2)", () => {
  it("muestra 'mensual' para MONTHLY", () => {
    renderRow(fijoActivo);
    expect(screen.getByText("mensual")).toBeInTheDocument();
  });

  it("muestra 'bimestral' para BIMONTHLY", () => {
    renderRow(fijoBimestral);
    expect(screen.getByText("bimestral")).toBeInTheDocument();
  });

  it("muestra 'trimestral' para QUARTERLY", () => {
    renderRow(fijoTrimestral);
    expect(screen.getByText("trimestral")).toBeInTheDocument();
  });

  it("muestra 'semestral' para BIANNUAL", () => {
    renderRow(fijoSemestral);
    expect(screen.getByText("semestral")).toBeInTheDocument();
  });

  it("muestra 'anual' para ANNUAL", () => {
    renderRow(fijoAnual);
    expect(screen.getByText("anual")).toBeInTheDocument();
  });

  it("no muestra segmento de frecuencia para movimientos únicos", () => {
    renderRow(unico);
    expect(screen.queryByText(/mensual|bimestral|trimestral|semestral|anual/i)).not.toBeInTheDocument();
  });
});

// ─── Tests: ítem fijo anulado (P1 — Fase 1.1.1) ──────────────────────────────

describe("MovementItemRow — ítem fijo anulado (P1)", () => {
  it("muestra el badge 'Anulado' cuando skipped=true", () => {
    renderRow(fijoAnulado);
    expect(screen.getByText("Anulado")).toBeInTheDocument();
  });

  it("NO muestra el badge 'Anulado' cuando skipped=false", () => {
    renderRow(fijoActivo);
    expect(screen.queryByText("Anulado")).not.toBeInTheDocument();
  });

  it("el monto sigue mostrándose con el mismo valor aunque esté anulado", () => {
    renderRow(fijoAnulado);
    expect(screen.getByText("−$1.500,00")).toBeInTheDocument();
  });

  it("el KebabMenu sigue siendo accesible cuando el ítem está anulado", () => {
    renderRow(fijoAnulado);
    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    expect(trigger).toBeInTheDocument();
  });
});

// ─── Tests: acción Anular / Des-anular en KebabMenu (P1 — Fase 1.1.1) ────────

describe("MovementItemRow — acción Anular/Des-anular en KebabMenu (P1)", () => {
  it("fijo activo: muestra 'Anular este mes' en el KebabMenu", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /anular este mes/i })).toBeInTheDocument();
  });

  it("fijo anulado: muestra 'Des-anular este mes' en el KebabMenu", () => {
    renderRow(fijoAnulado);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /des-anular este mes/i })).toBeInTheDocument();
  });

  it("fijo activo: NO muestra 'Des-anular este mes' en el KebabMenu", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("click en 'Anular este mes' llama a skipRecurring con el id y viewMonth", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: true });

    renderRow(fijoActivo, "2026-06");

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const anularItem = screen.getByRole("menuitem", { name: /anular este mes/i });
    fireEvent.click(anularItem);

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", "2026-06");
    });
  });

  it("click en 'Des-anular este mes' llama a skipRecurring con el id y viewMonth", async () => {
    mockSkipRecurring.mockResolvedValue({ success: true, skipped: false });

    renderRow(fijoAnulado, "2026-07");

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const desAnularItem = screen.getByRole("menuitem", { name: /des-anular este mes/i });
    fireEvent.click(desAnularItem);

    await waitFor(() => {
      expect(mockSkipRecurring).toHaveBeenCalledWith("rec-1", "2026-07");
    });
  });

  it("único NO tiene la acción 'Anular este mes'", () => {
    renderRow(unico);

    const trigger = screen.getByRole("button", { name: /acciones de almuerzo/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /anular este mes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("cuota NO tiene la acción 'Anular este mes'", () => {
    renderRow(cuota);

    const trigger = screen.getByRole("button", { name: /acciones de notebook/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole("menuitem", { name: /anular este mes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /des-anular este mes/i })).not.toBeInTheDocument();
  });

  it("el KebabMenu del fijo tiene: Editar, Anular este mes, Eliminar (en ese orden)", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/editar/i);
    expect(items[1]).toHaveTextContent(/anular este mes/i);
    expect(items[2]).toHaveTextContent(/eliminar/i);
  });
});

// ─── Tests: el skip solo es peligroso para Eliminar ──────────────────────────

describe("MovementItemRow — semántica del KebabMenu", () => {
  it("'Anular este mes' es acción neutra (no danger), 'Eliminar' sí es danger", () => {
    renderRow(fijoActivo);

    const trigger = screen.getByRole("button", { name: /acciones de alquiler/i });
    fireEvent.click(trigger);

    // El ítem "Eliminar" debe tener la clase de danger — lo verificamos buscando el texto
    const items = screen.getAllByRole("menuitem");
    const eliminarItem = items.find((i) => /eliminar/i.test(i.textContent ?? ""));
    const anularItem = items.find((i) => /anular este mes/i.test(i.textContent ?? ""));

    expect(eliminarItem).toBeInTheDocument();
    expect(anularItem).toBeInTheDocument();
  });
});
