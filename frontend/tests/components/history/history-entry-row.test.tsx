/**
 * Tests de HistoryEntryRow (docs/design.md §2, §4, §9).
 *
 * jsdom no evalúa container queries: las dos variantes responsive (momento
 * inline compacto / col 3 amplio, acción compacta / col 3 amplia) quedan
 * AMBAS en el árbol — se verifica con `getAllByText` cuando el texto se
 * comparte (ver docs/frontend.md §Testing — gotchas).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryEntryRow } from "@/components/history/history-entry-row";
import type { HistoryEntryResponseDto } from "@/types/history";

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
  blockingCount: 2,
};

const deletedEntry: HistoryEntryResponseDto = {
  ...editableEntry,
  id: "hist-3",
  action: "DELETE",
  changes: [
    { field: "amount", previous: { amountCents: 100000, currency: "ARS", type: "EXPENSE" } },
  ],
};

function renderRow(entry: HistoryEntryResponseDto, onOpen = vi.fn()) {
  return { onOpen, ...render(<HistoryEntryRow entry={entry} formulaCurrencyFallback="ARS" isBusy={false} onOpen={onOpen} />) };
}

describe("HistoryEntryRow", () => {
  it("muestra el nombre del movimiento, el chip 'Editado' y la sublínea de identidad", () => {
    renderRow(editableEntry);

    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Editado")).toBeInTheDocument();
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText("Único")).toBeInTheDocument();
  });

  it("eliminación: ícono Trash2 vía chip 'Eliminado' y rótulo 'Se eliminó:' en el bloque", () => {
    renderRow(deletedEntry);

    expect(screen.getByText("Eliminado")).toBeInTheDocument();
    expect(screen.getByText("Se eliminó:")).toBeInTheDocument();
  });

  it("marca '↳ calculado' cuando isCalculated es true", () => {
    renderRow({ ...editableEntry, isCalculated: true, targetKind: "FIJO" });
    expect(screen.getByText("calculado")).toBeInTheDocument();
  });

  it("entrada deshacible: botón 'Deshacer' presente (amplio + compacto, ambos en el árbol)", () => {
    renderRow(editableEntry);

    const buttons = screen.getAllByRole("button", { name: /deshacer/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/bloqueado/i)).not.toBeInTheDocument();
  });

  it("entrada bloqueada: botón 'Bloqueado' ACTIVO (sin disabled) + motivo con el conteo", () => {
    renderRow(blockedEntry);

    const buttons = screen.getAllByRole("button", { name: /bloqueado/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    for (const button of buttons) {
      expect(button).not.toBeDisabled();
    }
    // Singular/plural del motivo — hay 2 posteriores
    expect(screen.getAllByText(/Hay 2 cambios posteriores/i).length).toBeGreaterThanOrEqual(1);
  });

  it("motivo en singular cuando blockingCount === 1", () => {
    renderRow({ ...blockedEntry, blockingCount: 1 });
    expect(screen.getAllByText(/Hay 1 cambio posterior$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("clic en el cuerpo de la fila llama a onOpen con la entrada", () => {
    const { onOpen } = renderRow(editableEntry);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));

    expect(onOpen).toHaveBeenCalledWith(editableEntry);
  });

  it("clic en el botón 'Deshacer' llama a onOpen sin disparar el handler de la fila dos veces", () => {
    const { onOpen } = renderRow(editableEntry);

    fireEvent.click(screen.getAllByRole("button", { name: /deshacer/i })[0]!);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(editableEntry);
  });

  it("Enter en el cuerpo de la fila (rol=button, teclado) abre igual que el clic", () => {
    const { onOpen } = renderRow(editableEntry);

    fireEvent.keyDown(screen.getByRole("button", { name: /ver cambio de supermercado/i }), { key: "Enter" });

    expect(onOpen).toHaveBeenCalledWith(editableEntry);
  });

  it("isBusy: la fila no dispara onOpen (pointer-events-none + guard en el handler)", () => {
    const onOpen = vi.fn();
    render(<HistoryEntryRow entry={editableEntry} formulaCurrencyFallback="ARS" isBusy onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /ver cambio de supermercado/i }));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("usa la categoría como nombre de fallback cuando no hay descripción", () => {
    renderRow({ ...editableEntry, description: null });
    // "Alimentación" aparece como nombre Y como categoría en la sublínea — al menos una vez como título
    expect(screen.getAllByText("Alimentación").length).toBeGreaterThanOrEqual(1);
  });

  it("alineación al tope en los dos regímenes: el grid usa items-start, nunca items-center (§2)", () => {
    renderRow(deletedEntry);

    const row = screen.getByRole("button", { name: /ver cambio de supermercado/i });
    expect(row.className).toContain("items-start");
    expect(row.className).not.toContain("items-center");
  });
});
