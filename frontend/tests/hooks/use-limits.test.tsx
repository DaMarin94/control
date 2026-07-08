/**
 * Tests del hook useLimits (P2 — Fase 1, gestor de límites).
 *
 * Verifica:
 * - limits refleja preferences.limits (o [] si ausente/no-array)
 * - create() agrega un límite nuevo (enabled=true, id generado) vía setPreferences
 *   con el blob COMPLETO (merge manual — semántica de reemplazo total)
 * - remove() quita el límite por id
 * - setEnabled() alterna enabled sin tocar el resto del límite (D8: no es "editar")
 * - Propagación de errores de setPreferences
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLimits } from "@/hooks/use-limits";
import type { LimitConfig } from "@/types/limit";

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(),
}));

import { usePreferences } from "@/hooks/use-preferences";

const mockUsePreferences = vi.mocked(usePreferences);

const existingLimit: LimitConfig = {
  id: "limit-existing",
  enabled: true,
  anchorKey: "mes.total.gasto",
  temporalScope: "all",
  operator: "gt",
  threshold: 300000,
  nature: "passive",
  effect: "badge",
};

describe("useLimits", () => {
  const mockSetPreferences = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPreferences.mockResolvedValue({ success: true, preferences: {} });
    mockUsePreferences.mockReturnValue({
      preferences: { limits: [existingLimit] },
      setPreferences: mockSetPreferences,
      isLoading: false,
      isSaving: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePreferences>);
  });

  it("expone limits desde preferences.limits", () => {
    const { result } = renderHook(() => useLimits());
    expect(result.current.limits).toEqual([existingLimit]);
  });

  it("expone [] cuando preferences.limits está ausente", () => {
    mockUsePreferences.mockReturnValue({
      preferences: {},
      setPreferences: mockSetPreferences,
      isLoading: false,
      isSaving: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePreferences>);

    const { result } = renderHook(() => useLimits());
    expect(result.current.limits).toEqual([]);
  });

  it("expone [] cuando preferences.limits no es un array (defensivo)", () => {
    mockUsePreferences.mockReturnValue({
      preferences: { limits: "not-an-array" as unknown },
      setPreferences: mockSetPreferences,
      isLoading: false,
      isSaving: false,
      isError: false,
      error: null,
    } as ReturnType<typeof usePreferences>);

    const { result } = renderHook(() => useLimits());
    expect(result.current.limits).toEqual([]);
  });

  describe("create", () => {
    it("llama a setPreferences con el blob completo + el límite nuevo agregado", async () => {
      const { result } = renderHook(() => useLimits());

      await act(async () => {
        await result.current.create({
          anchorKey: "mes.total.ingreso",
          temporalScope: "all",
          operator: "lt",
          threshold: 50000,
          nature: "passive",
          effect: "glyph",
        });
      });

      expect(mockSetPreferences).toHaveBeenCalledTimes(1);
      const [payload] = mockSetPreferences.mock.calls[0]!;
      expect(payload.limits).toHaveLength(2);
      expect(payload.limits[0]).toEqual(existingLimit); // preserva el existente
      const created = payload.limits[1];
      expect(created.anchorKey).toBe("mes.total.ingreso");
      expect(created.enabled).toBe(true);
      expect(typeof created.id).toBe("string");
      expect(created.id.length).toBeGreaterThan(0);
    });

    it("devuelve success=true en éxito", async () => {
      const { result } = renderHook(() => useLimits());
      let out: Awaited<ReturnType<typeof result.current.create>>;
      await act(async () => {
        out = await result.current.create({
          anchorKey: "mes.total.gasto",
          temporalScope: "all",
          operator: "gt",
          threshold: 1000,
          nature: "passive",
          effect: "badge",
        });
      });
      expect(out!.success).toBe(true);
    });

    it("propaga el error cuando setPreferences falla", async () => {
      mockSetPreferences.mockResolvedValue({ success: false, error: "boom" });
      const { result } = renderHook(() => useLimits());

      let out: Awaited<ReturnType<typeof result.current.create>>;
      await act(async () => {
        out = await result.current.create({
          anchorKey: "mes.total.gasto",
          temporalScope: "all",
          operator: "gt",
          threshold: 1000,
          nature: "passive",
          effect: "badge",
        });
      });
      expect(out!.success).toBe(false);
      expect(out!.error).toBe("boom");
    });
  });

  describe("remove", () => {
    it("quita el límite por id del blob completo", async () => {
      const { result } = renderHook(() => useLimits());

      await act(async () => {
        await result.current.remove("limit-existing");
      });

      expect(mockSetPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ limits: [] }),
      );
    });

    it("no rompe si el id no existe (no-op sobre el array)", async () => {
      const { result } = renderHook(() => useLimits());

      await act(async () => {
        await result.current.remove("id-inexistente");
      });

      expect(mockSetPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ limits: [existingLimit] }),
      );
    });
  });

  describe("setEnabled", () => {
    it("alterna enabled sin tocar el resto del límite (D8)", async () => {
      const { result } = renderHook(() => useLimits());

      await act(async () => {
        await result.current.setEnabled("limit-existing", false);
      });

      const [payload] = mockSetPreferences.mock.calls[0]!;
      expect(payload.limits[0]).toEqual({ ...existingLimit, enabled: false });
    });
  });
});
