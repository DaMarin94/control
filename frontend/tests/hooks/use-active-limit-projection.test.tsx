/**
 * Tests del hook useActiveLimitProjection (P2 — Fase 2).
 *
 * Verifica:
 * - evaluate() delega en projectActiveLimitCrossings con los movimientos
 *   crudos del mes destino (useMovements) y los límites del usuario (useLimits).
 * - Falla ABIERTO (devuelve []) si useMovements todavía no resolvió datos
 *   (loading) — la activa nunca bloquea un guardado por latencia de red.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import type { LimitConfig } from "@/types/limit";
import type { MonthMovements } from "@/types/movement";

vi.mock("@/hooks/use-movements", () => ({
  useMovements: vi.fn(),
}));

vi.mock("@/hooks/use-limits", () => ({
  useLimits: vi.fn(),
}));

import { useMovements } from "@/hooks/use-movements";
import { useLimits } from "@/hooks/use-limits";

const mockUseMovements = vi.mocked(useMovements);
const mockUseLimits = vi.mocked(useLimits);

const activeLimit: LimitConfig = {
  id: "l1",
  enabled: true,
  anchorKey: "mes.total.gasto",
  operator: "gt",
  threshold: 100,
  nature: "active",
};

const emptyMonthMovements: MonthMovements = {
  month: "2026-06",
  totals: { expenseCents: 0, incomeCents: 0, balanceCents: 0 },
  movements: { unicos: [], fijos: [], cuotas: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLimits.mockReturnValue({
    limits: [activeLimit],
    isLoading: false,
    isSaving: false,
    create: vi.fn(),
    remove: vi.fn(),
    setEnabled: vi.fn(),
  });
});

describe("useActiveLimitProjection", () => {
  it("evalúa los cruces usando los movimientos del mes destino y los límites del usuario", () => {
    mockUseMovements.mockReturnValue({
      data: emptyMonthMovements,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMovements>);

    const { result } = renderHook(() => useActiveLimitProjection("2026-06"));

    const crossed = result.current.evaluate({
      type: "EXPENSE",
      convertedAmountCents: 20000, // $200 > $100
      categoryId: "cat-1",
      section: "unicos",
      skipped: false,
    });

    expect(crossed.map((l) => l.id)).toEqual(["l1"]);
  });

  it("consulta useMovements con el mes de proyección recibido", () => {
    mockUseMovements.mockReturnValue({
      data: emptyMonthMovements,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMovements>);

    renderHook(() => useActiveLimitProjection("2026-09"));

    expect(mockUseMovements).toHaveBeenCalledWith("2026-09");
  });

  it("falla ABIERTO (devuelve []) si los movimientos del mes destino todavía no resolvieron", () => {
    mockUseMovements.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useMovements>);

    const { result } = renderHook(() => useActiveLimitProjection("2026-06"));

    const crossed = result.current.evaluate({
      type: "EXPENSE",
      convertedAmountCents: 20000,
      categoryId: "cat-1",
      section: "unicos",
      skipped: false,
    });

    expect(crossed).toEqual([]);
  });
});
