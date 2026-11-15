/**
 * Tests de la entrada "Reabierto" del historial (RF-MF-008, docs/design.md
 * §"Reabrir un fijo terminado" §7): chip + glifo, fila `Vigencia` (par
 * `hasta {último mes} → desde {X}`), modal de deshacer (encabezado de edición,
 * par invertido) y resumen en el modal de cadena.
 *
 * `Tramo anulado` (rango skippedFrom/skippedTo) y `Calculados` se testean en buildHistoryDisplays.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryEntryRow } from "@/components/history/history-entry-row";
import { UndoConfirmModal } from "@/components/history/undo-confirm-modal";
import { ChainUndoModal } from "@/components/history/chain-undo-modal";
import { buildHistoryDisplays, summarizeHistoryEntry } from "@/lib/history";
import type { HistoryEntryResponseDto } from "@/types/history";

/** Reapertura de "Gimnasio": terminaba en Jul 2026 (último mes: Jun 2026), vuelve en Sep 2026. */
const reopenEntry: HistoryEntryResponseDto = {
  id: "hist-r1",
  targetKind: "FIJO",
  targetId: "chain-1",
  action: "REOPEN",
  createdAt: "2026-09-02T17:30:00.000Z",
  description: "Gimnasio",
  category: { id: "cat-1", name: "Salud", color: "#FF5733", scope: "EXPENSE" },
  type: "EXPENSE",
  amount: { amountCents: 200000, currency: "ARS", type: "EXPENSE" },
  isCalculated: false,
  changes: [],
  canUndo: true,
  blockingCount: 0,
  reopen: { endMonth: "2026-07", reopenMonth: "2026-09", skippedCount: 0, skippedFrom: null, skippedTo: null, reopenedCalculated: [] },
};

const reopenWithAmount: HistoryEntryResponseDto = {
  ...reopenEntry,
  id: "hist-r2",
  changes: [
    {
      field: "amount",
      previous: { amountCents: 150000, currency: "ARS", type: "EXPENSE" },
      next: { amountCents: 200000, currency: "ARS", type: "EXPENSE" },
    },
    {
      field: "paymentMethod",
      previous: { id: "pm-1", name: "Débito viejo" },
      next: null,
    },
  ],
};

describe("HistoryEntryRow — entrada Reabierto", () => {
  it("muestra el chip 'Reabierto' y la sublínea '● Categoría · Fijo'", () => {
    render(<HistoryEntryRow entry={reopenEntry} isBusy={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Reabierto")).toBeInTheDocument();
    expect(screen.queryByText("Editado")).not.toBeInTheDocument();
    expect(screen.getByText("Salud")).toBeInTheDocument();
    expect(screen.getByText("Fijo")).toBeInTheDocument();
  });

  it("con `changes` vacío igual muestra la fila Vigencia: 'hasta Jun 2026 → desde Sept 2026'", () => {
    render(<HistoryEntryRow entry={reopenEntry} isBusy={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Vigencia")).toBeInTheDocument();
    expect(screen.getByText("hasta")).toBeInTheDocument();
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("desde")).toBeInTheDocument();
    expect(screen.getByText("Sept 2026")).toBeInTheDocument();
    // No es una eliminación: sin encabezado "Se eliminó:".
    expect(screen.queryByText("Se eliminó:")).not.toBeInTheDocument();
  });

  it("una entrada de edición común no suma ninguna fila Vigencia", () => {
    const editEntry: HistoryEntryResponseDto = {
      ...reopenEntry,
      action: "EDIT",
      reopen: null,
      changes: [
        {
          field: "amount",
          previous: { amountCents: 1, currency: "ARS", type: "EXPENSE" },
          next: { amountCents: 2, currency: "ARS", type: "EXPENSE" },
        },
      ],
    };
    render(<HistoryEntryRow entry={editEntry} isBusy={false} onOpen={vi.fn()} />);
    expect(screen.queryByText("Vigencia")).not.toBeInTheDocument();
    expect(screen.getByText("Editado")).toBeInTheDocument();
  });

  it("clic en el cuerpo abre la entrada (mismo camino que el botón Deshacer)", () => {
    const onOpen = vi.fn();
    render(<HistoryEntryRow entry={reopenEntry} isBusy={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /ver cambio de gimnasio/i }));
    expect(onOpen).toHaveBeenCalledWith(reopenEntry);
  });
});

describe("buildHistoryDisplays — fila Vigencia", () => {
  it("va entre 'Mes de inicio'/'Categoría' y 'Método de pago' (antes de Cuotas/Método/Débito)", () => {
    const labels = buildHistoryDisplays(reopenWithAmount, "list").map((d) => d.label);
    expect(labels).toEqual(["Monto", "Vigencia", "Método de pago"]);
  });

  it("sin cambios de datos, Vigencia es la única fila", () => {
    expect(buildHistoryDisplays(reopenEntry, "list").map((d) => d.label)).toEqual(["Vigencia"]);
  });

  it("lista: hasta → desde; modal: invertido (desde → hasta)", () => {
    const list = buildHistoryDisplays(reopenEntry, "list")[0]!;
    expect([list.leftPrefix, list.leftText, list.rightPrefix, list.rightText]).toEqual([
      "hasta",
      "Jun 2026",
      "desde",
      "Sept 2026",
    ]);
    const modal = buildHistoryDisplays(reopenEntry, "modal")[0]!;
    expect([modal.leftPrefix, modal.leftText, modal.rightPrefix, modal.rightText]).toEqual([
      "desde",
      "Sept 2026",
      "hasta",
      "Jun 2026",
    ]);
  });

  it("con relleno y calculados suma 'Tramo anulado' y 'Calculados' tras Vigencia (valor único)", () => {
    const entry = {
      ...reopenEntry,
      reopen: {
        endMonth: "2026-07",
        reopenMonth: "2026-09",
        skippedCount: 2,
        skippedFrom: "2026-07",
        skippedTo: "2026-08",
        reopenedCalculated: [{ chainId: "c1", description: "IVA" }],
      },
    };
    const list = buildHistoryDisplays(entry, "list");
    expect(list.map((d) => d.label)).toEqual(["Vigencia", "Tramo anulado", "Calculados"]);
    expect([list[1]!.leftText, list[1]!.rightText]).toEqual([null, "2 apariciones · Jul 2026 – Ago 2026"]);
    expect(list[2]!.rightText).toBe("1 reabierto");
    const modal = buildHistoryDisplays(entry, "modal");
    expect(modal[1]!.rightText).toBe("Vuelve a quedar fuera de vigencia");
    expect(modal[2]!.rightText).toBe("1 vuelve a terminar");
  });

  it("singular/plural de los conteos", () => {
    const mk = (n: number, calc: number) => ({
      changes: [],
      reopen: {
        endMonth: "2026-07",
        reopenMonth: "2026-09",
        skippedCount: n,
        skippedFrom: n ? "2026-07" : null,
        skippedTo: n ? "2026-07" : null,
        reopenedCalculated: Array.from({ length: calc }, (_, i) => ({ chainId: `c${i}`, description: `C${i}` })),
      },
    });
    expect(buildHistoryDisplays(mk(1, 3), "list").map((d) => d.rightText).slice(1)).toEqual(["una aparición · Jul 2026", "3 reabiertos"]);
    expect(buildHistoryDisplays(mk(1, 3), "modal").map((d) => d.rightText).slice(2)).toEqual(["3 vuelven a terminar"]);
  });

  it("fin a futuro con X = endMonth: 'hasta Nov 2026 → desde Dic 2026'", () => {
    const [row] = buildHistoryDisplays({ changes: [], reopen: { endMonth: "2026-12", reopenMonth: "2026-12", skippedCount: 0, skippedFrom: null, skippedTo: null, reopenedCalculated: [] } }, "list");
    expect([row!.leftText, row!.rightText]).toEqual(["Nov 2026", "Dic 2026"]);
  });
});

describe("summarizeHistoryEntry", () => {
  it("con monto en el diff resume el monto", () => {
    expect(summarizeHistoryEntry(reopenWithAmount)?.text).toMatch(/^Monto: /);
  });

  it("sin monto en el diff resume la vigencia: 'Vigencia: desde Sept 2026'", () => {
    expect(summarizeHistoryEntry(reopenEntry)).toEqual({ text: "Vigencia: desde Sept 2026", nowrap: true });
  });
});

describe("UndoConfirmModal — entrada Reabierto", () => {
  it("reusa el encabezado de la edición y muestra el par invertido de Vigencia", () => {
    render(<UndoConfirmModal entry={reopenEntry} isSubmitting={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Al deshacer queda así:")).toBeInTheDocument();
    expect(screen.queryByText("Vuelve a la app:")).not.toBeInTheDocument();
    expect(screen.getByText("Vigencia")).toBeInTheDocument();
    // desde Sept 2026 → hasta Jun 2026
    const row = screen.getByText("Vigencia").parentElement!;
    expect(row.textContent).toMatch(/desde\s*Sept 2026.*→.*hasta\s*Jun 2026/);
    expect(screen.getByText("Esta entrada se borra del historial.")).toBeInTheDocument();
  });
});

describe("ChainUndoModal — entrada Reabierto en la cadena", () => {
  it("muestra el chip 'Reabierto' y el resumen de vigencia", () => {
    const blocking = { ...reopenEntry, id: "hist-r3", canUndo: false, blockingCount: 1 };
    const later: HistoryEntryResponseDto = {
      ...reopenEntry,
      id: "hist-e1",
      action: "EDIT",
      reopen: null,
      changes: [
        {
          field: "amount",
          previous: { amountCents: 1, currency: "ARS", type: "EXPENSE" },
          next: { amountCents: 2, currency: "ARS", type: "EXPENSE" },
        },
      ],
    };
    render(
      <ChainUndoModal
        entry={blocking}
        chainEntries={[later, blocking]}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Reabierto")).toBeInTheDocument();
    expect(screen.getByText("Editado")).toBeInTheDocument();
    expect(screen.getByText("Vigencia: desde Sept 2026")).toBeInTheDocument();
  });
});

describe("buildHistoryDisplays — Tramo anulado sin rango", () => {
  it("si el contrato no trae from/to, muestra solo el conteo", () => {
    const rows = buildHistoryDisplays(
      { changes: [], reopen: { endMonth: "2026-07", reopenMonth: "2026-09", skippedCount: 3, skippedFrom: null, skippedTo: null, reopenedCalculated: [] } },
      "list",
    );
    expect(rows[1]!.rightText).toBe("3 apariciones");
  });

  it("rango con Sept: '2 apariciones · Ago 2026 – Sept 2026'", () => {
    const rows = buildHistoryDisplays(
      { changes: [], reopen: { endMonth: "2026-07", reopenMonth: "2026-10", skippedCount: 2, skippedFrom: "2026-08", skippedTo: "2026-09", reopenedCalculated: [] } },
      "list",
    );
    expect(rows[1]!.rightText).toBe("2 apariciones · Ago 2026 – Sept 2026");
  });
});
