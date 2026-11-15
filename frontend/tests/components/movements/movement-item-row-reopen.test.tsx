/**
 * Tests de la acción "Reabrir" del KebabMenu de MovementItemRow (RF-MF-008,
 * docs/design.md §"Reabrir un fijo terminado" §1).
 *
 * Gate: fijo NORMAL (no calculado, no simulado) con `endMonth`. En cualquier
 * otro ítem la acción NO existe (ni deshabilitada). Posición: después de
 * Anular, antes de Duplicar.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MovementItemRow } from "@/components/movements/movement-item-row";
import { ToastProvider } from "@/components/ui/toast";
import type { MovementItem } from "@/types/movement";

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: vi.fn(() => ({ skipTransaction: vi.fn() })),
}));
vi.mock("@/hooks/use-installments", () => ({
  useInstallments: vi.fn(() => ({ skipInstallment: vi.fn() })),
}));
vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({ defaultCurrency: "ARS" })),
}));

const fijoConFin: MovementItem = {
  id: "rec-1",
  origin: "fijo",
  type: "EXPENSE",
  amountCents: 150000,
  description: "Gimnasio",
  occurredAt: null,
  timezone: null,
  installment: null,
  frequency: 1,
  startMonth: "2024-03",
  endMonth: "2026-07",
  chainId: "chain-1",
  skipped: false,
  category: { id: "cat-1", name: "Salud", color: "#FF5733", scope: "EXPENSE" },
  paymentMethod: null,
  autoDebit: null,
  calculated: null,
  hasCalculated: false,
  currency: "ARS",
  exchangeRate: 1,
  convertedAmountCents: 150000,
  simulated: false,
  calculatedChildren: [],
  evolutionAvailable: false,
};

function renderRow(movement: MovementItem, onReopen = vi.fn()) {
  const queryClient = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }
  render(
    <MovementItemRow
      movement={movement}
      viewMonth="2026-05"
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onSkipScope={vi.fn()}
      onReopen={onReopen}
      onDuplicate={vi.fn()}
      onCreateCalculated={vi.fn()}
    />,
    { wrapper: Wrapper },
  );
  fireEvent.click(screen.getByRole("button", { name: /acciones de gimnasio/i }));
  return { onReopen };
}

describe("MovementItemRow — Reabrir (RF-MF-008)", () => {
  it("un fijo normal con fin muestra 6 ítems, 'Reabrir' tercero (entre Anular y Duplicar)", () => {
    renderRow(fijoConFin);
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent(/^editar$/i);
    expect(items[1]).toHaveTextContent(/anular este mes/i);
    expect(items[2]).toHaveTextContent(/^reabrir$/i);
    expect(items[3]).toHaveTextContent(/^duplicar$/i);
    expect(items[4]).toHaveTextContent(/crear movimiento calculado/i);
    expect(items[5]).toHaveTextContent(/^eliminar$/i);
  });

  it("'Reabrir' es neutro (no danger) y llama a onReopen con el movimiento", () => {
    const { onReopen } = renderRow(fijoConFin);
    const item = screen.getByRole("menuitem", { name: /^reabrir$/i });
    expect(item.className).not.toMatch(/expense|danger|red/);
    fireEvent.click(item);
    expect(onReopen).toHaveBeenCalledWith(fijoConFin);
  });

  it("un fijo SIN fin no ofrece 'Reabrir'", () => {
    renderRow({ ...fijoConFin, endMonth: null });
    expect(screen.queryByRole("menuitem", { name: /reabrir/i })).not.toBeInTheDocument();
  });

  it("un calculado de fijo (aunque tenga fin) no ofrece 'Reabrir'", () => {
    renderRow({
      ...fijoConFin,
      calculated: {
        sourceType: "fijo",
        sourceId: "chain-x",
        sourceChainId: "chain-x",
        sourceDescription: "Origen",
        formulaOperator: "PCT",
        formulaOperand: 1000,
        formulaSign: 1,
        sourceAmountCents: 1000,
        sourceMonthOffset: 0,
      },
    });
    expect(screen.queryByRole("menuitem", { name: /reabrir/i })).not.toBeInTheDocument();
  });

  it("un único y una cuota no ofrecen 'Reabrir'", () => {
    renderRow({ ...fijoConFin, origin: "unico", frequency: null, endMonth: null });
    expect(screen.queryByRole("menuitem", { name: /reabrir/i })).not.toBeInTheDocument();
  });

  it("un ítem simulado no ofrece 'Reabrir'", () => {
    renderRow({ ...fijoConFin, simulated: true });
    expect(screen.queryByRole("menuitem", { name: /reabrir/i })).not.toBeInTheDocument();
  });
});
