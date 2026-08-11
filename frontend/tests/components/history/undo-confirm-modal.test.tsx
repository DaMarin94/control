/**
 * Tests de UndoConfirmModal (docs/design.md §5).
 *
 * Verifica: título, frase de encuadre con el nombre, caja de identidad,
 * heading del bloque según edición/eliminación, footer (Cancelar/Deshacer,
 * loading), y que el bloque de cambios use `direction="modal"` (par
 * invertido — cubierto en profundidad por tests/lib/history.test.ts;
 * acá solo se verifica el heading correcto por acción).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoConfirmModal } from "@/components/history/undo-confirm-modal";
import type { HistoryEntryResponseDto } from "@/types/history";

const editEntry: HistoryEntryResponseDto = {
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

const deleteEntry: HistoryEntryResponseDto = {
  ...editEntry,
  id: "hist-2",
  action: "DELETE",
  changes: [{ field: "amount", previous: { amountCents: 100000, currency: "ARS", type: "EXPENSE" } }],
};

describe("UndoConfirmModal", () => {
  it("título 'Deshacer cambio' y frase de encuadre con el nombre del movimiento", () => {
    render(
      <UndoConfirmModal
        entry={editEntry}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Deshacer cambio" })).toBeInTheDocument();
    expect(screen.getByText(/se va a restaurar/i)).toBeInTheDocument();
    expect(screen.getAllByText("Supermercado").length).toBeGreaterThanOrEqual(1);
  });

  it("edición: heading 'Al deshacer queda así:'", () => {
    render(
      <UndoConfirmModal
        entry={editEntry}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Al deshacer queda así:")).toBeInTheDocument();
  });

  it("eliminación: heading 'Vuelve a la app:'", () => {
    render(
      <UndoConfirmModal
        entry={deleteEntry}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Vuelve a la app:")).toBeInTheDocument();
  });

  it("nota de consecuencia y footer con Cancelar + Deshacer", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <UndoConfirmModal
        entry={editEntry}
        isSubmitting={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Esta entrada se borra del historial.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("isSubmitting: botón primario dice 'Deshaciendo…' y ambos botones se deshabilitan", () => {
    render(
      <UndoConfirmModal
        entry={editEntry}
        isSubmitting
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /deshaciendo…/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });
});
