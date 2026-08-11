/**
 * Tests de ChainUndoModal (docs/design.md §6, RF-HIST-004).
 *
 * Verifica: título, callout con nombre + N posteriores, lista de la más
 * reciente a la más antigua con la entrada abierta marcada "(esta)" al
 * final, botón primario con el TOTAL real (N+1), y footer.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ChainUndoModal } from "@/components/history/chain-undo-modal";
import type { HistoryEntryResponseDto } from "@/types/history";

function makeEntry(overrides: Partial<HistoryEntryResponseDto>): HistoryEntryResponseDto {
  return {
    id: "hist-x",
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
    canUndo: false,
    blockingCount: 1,
    ...overrides,
  };
}

// La entrada abierta (más antigua, bloqueada) — blockingCount=1 (un posterior).
const openEntry = makeEntry({ id: "hist-old", createdAt: "2026-06-01T10:00:00.000Z", blockingCount: 1 });
// El posterior (más reciente, blockingCount=0).
const newerEntry = makeEntry({ id: "hist-new", createdAt: "2026-06-02T17:30:00.000Z", blockingCount: 0, canUndo: true });

// Orden esperado: más reciente primero, la abierta al final (ver computeChainEntries en history-client.tsx).
const chainEntries = [newerEntry, openEntry];

describe("ChainUndoModal", () => {
  it("título 'Hay cambios posteriores' y callout con el nombre y el N de blockingCount (N ≥ 2)", () => {
    const olderEntry = makeEntry({ id: "hist-old2", createdAt: "2026-05-31T10:00:00.000Z", blockingCount: 2 });
    const chain2 = [newerEntry, makeEntry({ id: "hist-mid", createdAt: "2026-06-01T10:00:00.000Z", blockingCount: 1, canUndo: true }), olderEntry];

    render(
      <ChainUndoModal
        entry={olderEntry}
        chainEntries={chain2}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Hay cambios posteriores" })).toBeInTheDocument();
    expect(screen.getByText(/para deshacerlo hay que deshacer antes los/i)).toBeInTheDocument();
    // El N son los POSTERIORES (blockingCount), no el total.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("concordancia N = 1 — callout usa 'el cambio posterior', SIN numeral (nunca 'los 1 cambios')", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/para deshacerlo hay que deshacer antes/i).textContent).toContain(
      "el cambio posterior",
    );
    expect(screen.queryByText(/los 1 cambios? posteriores?/i)).not.toBeInTheDocument();
  });

  it("lista 'Se van a deshacer, en este orden' — la entrada abierta queda última, marcada '(esta)'", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Se van a deshacer, en este orden:")).toBeInTheDocument();
    expect(screen.getByText("(esta)")).toBeInTheDocument();
  });

  it("botón primario dice 'Deshacer los {N+1} cambios' — el TOTAL real, no solo los posteriores", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // blockingCount=1 (posteriores) + la entrada abierta = 2 total
    expect(screen.getByRole("button", { name: /deshacer los 2 cambios/i })).toBeInTheDocument();
  });

  it("nota de consecuencia y Cancelar sin llamar a onConfirm", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Todas se borran del historial.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("isSubmitting: botón primario 'Deshaciendo…' deshabilitado", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /deshaciendo…/i })).toBeDisabled();
  });

  it("confirmar dispara onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /deshacer los 2 cambios/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("cada fila de la lista compacta muestra el chip de operación", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Editado").length).toBe(2);
  });

  it("resumen de cada fila: UN SOLO VALOR (el resultante), nunca el par 'anterior → nuevo'", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={chainEntries}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Las dos entradas cambiaron el monto de 1.000,00 a 1.500,00 → el resumen muestra SOLO el resultante.
    expect(screen.getAllByText("Monto: −$1.500,00").length).toBe(2);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("cifra larga del resumen nunca trunca con elipsis — envuelve entera (§6.2, prioridad 2)", () => {
    const bigAmountEntry = makeEntry({
      id: "hist-big",
      blockingCount: 1,
      changes: [
        {
          field: "amount",
          previous: { amountCents: 32500000, currency: "ARS", type: "EXPENSE" },
          next: { amountCents: 35000000, currency: "ARS", type: "EXPENSE" },
        },
      ],
    });
    render(
      <ChainUndoModal
        entry={bigAmountEntry}
        chainEntries={[bigAmountEntry]}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // La cifra completa está en el DOM, sin cortar ("…") — el resumen puede envolver, nunca truncar.
    const summary = screen.getByText("Monto: −$350.000,00");
    expect(summary).toBeInTheDocument();
    expect(summary.className).toContain("whitespace-nowrap");
  });

  it("footer: singular defensivo 'Deshacer el cambio' cuando el total es 1 (nunca 'los 1 cambios')", () => {
    render(
      <ChainUndoModal
        entry={openEntry}
        chainEntries={[openEntry]}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Deshacer el cambio" })).toBeInTheDocument();
  });
});
