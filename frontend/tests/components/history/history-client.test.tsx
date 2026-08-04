/**
 * Tests de HistoryClient (docs/design.md §"Historial de cambios (`/historial`)",
 * RF-HIST-002/003/004).
 *
 * Verifica: cabecera con la regla de retención, carga (skeleton), error,
 * vacío (sin CTA), lista con entradas, apertura del modal de deshacer /
 * del modal de cadena según `canUndo`, y el flujo de confirmación (éxito
 * invalida vía el hook, error deja el modal abierto).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { HistoryClient } from "@/components/history/history-client";
import type { HistoryEntryResponseDto } from "@/types/history";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-history", () => ({
  useHistory: vi.fn(),
  useUndoHistory: vi.fn(),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({ defaultCurrency: "ARS" })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));

import { useHistory, useUndoHistory } from "@/hooks/use-history";
import { useToast } from "@/hooks/use-toast";

const mockUseHistory = vi.mocked(useHistory);
const mockUseUndoHistory = vi.mocked(useUndoHistory);
const mockUseToast = vi.mocked(useToast);

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const editableEntry: HistoryEntryResponseDto = {
  id: "hist-1",
  targetKind: "UNICO",
  targetId: "tx-1",
  action: "EDIT",
  createdAt: "2026-06-02T17:30:00.000Z",
  description: "Supermercado",
  category: { id: "cat-1", name: "Alimentación", color: "#FF5733", scope: "BOTH" },
  type: "EXPENSE",
  amount: { amountCents: 150000, currency: "ARS", type: "EXPENSE" },
  isCalculated: false,
  changes: [
    {
      field: "amount",
      previous: { amountCents: 100000, currency: "ARS", type: "EXPENSE" },
      next: { amountCents: 150000, currency: "ARS", type: "EXPENSE" },
    },
  ],
  canUndo: true,
  blockingCount: 0,
};

const blockedEntry: HistoryEntryResponseDto = {
  ...editableEntry,
  id: "hist-2",
  canUndo: false,
  blockingCount: 1,
};

const mockUndo = vi.fn();

function mockHistoryData(overrides: Partial<ReturnType<typeof useHistory>> = {}) {
  mockUseHistory.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useHistory>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUndoHistory.mockReturnValue({ undo: mockUndo, isUndoing: false });
  mockUseToast.mockReturnValue({
    toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() },
    dismiss: vi.fn(),
  });
});

describe("HistoryClient", () => {
  it("cabecera: título 'Historial' y la regla de retención siempre visible", () => {
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    expect(screen.getByRole("heading", { name: "Historial" })).toBeInTheDocument();
    expect(screen.getByText(/se guardan los últimos 5 cambios/i)).toBeInTheDocument();
  });

  it("carga: skeleton con role=status y aria-label, sin la lista real", () => {
    mockHistoryData({ isLoading: true, data: undefined });
    render(<HistoryClient />);

    expect(screen.getByRole("status", { name: /cargando historial/i })).toBeInTheDocument();
    expect(screen.queryByText("Supermercado")).not.toBeInTheDocument();
  });

  it("error: mensaje inline, sin skeleton y sin lista vacía debajo", () => {
    mockHistoryData({ isError: true, data: undefined });
    render(<HistoryClient />);

    expect(screen.getByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("vacío: caja dashed con título y línea de apoyo, SIN CTA", () => {
    mockHistoryData({ data: [] });
    render(<HistoryClient />);

    expect(screen.getByText("Todavía no hay cambios registrados.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con datos: lista la entrada", () => {
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    expect(screen.getByText("Supermercado")).toBeInTheDocument();
  });

  it("abre el modal de deshacer al clickear una entrada deshacible", () => {
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));

    expect(screen.getByRole("dialog", { name: "Deshacer cambio" })).toBeInTheDocument();
  });

  it("abre el modal de cadena al clickear una entrada bloqueada", () => {
    mockHistoryData({ data: [blockedEntry] });
    render(<HistoryClient />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));

    expect(screen.getByRole("dialog", { name: "Hay cambios posteriores" })).toBeInTheDocument();
  });

  it("confirmar deshacer: llama undo(id), muestra toast de éxito y cierra el modal", async () => {
    mockUndo.mockResolvedValue({ success: true });
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));
    const dialog = screen.getByRole("dialog", { name: "Deshacer cambio" });
    fireEvent.click(within(dialog).getByRole("button", { name: /^deshacer$/i }));

    await waitFor(() => {
      expect(mockUndo).toHaveBeenCalledWith("hist-1");
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("falla el deshacer: toast de error y el modal queda ABIERTO", async () => {
    mockUndo.mockResolvedValue({ success: false, error: "No se pudo deshacer el cambio. Intentá de nuevo." });
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));
    const dialog = screen.getByRole("dialog", { name: "Deshacer cambio" });
    fireEvent.click(within(dialog).getByRole("button", { name: /^deshacer$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("No se pudo deshacer el cambio. Intentá de nuevo.");
    });
    expect(screen.getByRole("dialog", { name: "Deshacer cambio" })).toBeInTheDocument();
  });

  it("cancelar el modal de deshacer no llama a undo", () => {
    mockHistoryData({ data: [editableEntry] });
    render(<HistoryClient />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(mockUndo).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("modal de cadena: el botón primario dice 'Deshacer los N cambios' (N = total real, posteriores + esta)", () => {
    const olderBlocked: HistoryEntryResponseDto = { ...blockedEntry, id: "hist-2", blockingCount: 1 };
    const newest: HistoryEntryResponseDto = { ...editableEntry, id: "hist-1", blockingCount: 0, canUndo: true };
    mockHistoryData({ data: [newest, olderBlocked] });
    render(<HistoryClient />);

    const rows = screen.getAllByRole("button", { name: /ver cambio de supermercado/i });
    // La segunda fila (bloqueada) — abrir su modal de cadena
    fireEvent.click(rows[1]!);

    expect(screen.getByRole("button", { name: /deshacer los 2 cambios/i })).toBeInTheDocument();
  });
});
