/**
 * Tests de buildUndoAction — puente entre useUndoHistory() y el contrato
 * ToastAction["onClick"] async del sistema de toasts.
 */

import { describe, it, expect, vi } from "vitest";
import { buildUndoAction } from "@/lib/toast-undo";
import type { UndoHistoryResult } from "@/hooks/use-history";

describe("buildUndoAction", () => {
  it("éxito: devuelve outcome success con el copy de /historial", async () => {
    const undo = vi.fn<(id: string) => Promise<UndoHistoryResult>>(async () => ({
      success: true,
    }));

    const action = buildUndoAction(undo, "hist-1");
    const outcome = await action();

    expect(undo).toHaveBeenCalledWith("hist-1");
    expect(outcome).toEqual({ type: "success", message: "Cambio deshecho." });
  });

  it("404 (obsoleto): devuelve outcome warning con el mensaje exacto de useUndoHistory", async () => {
    const undo = vi.fn<(id: string) => Promise<UndoHistoryResult>>(async () => ({
      success: false,
      error: "Este cambio ya no está disponible para deshacer.",
    }));

    const action = buildUndoAction(undo, "hist-2");
    const outcome = await action();

    expect(outcome).toEqual({
      type: "warning",
      message: "Este cambio ya no está disponible para deshacer.",
    });
  });

  it("error de red/5xx: lanza (dispara el camino de reintento del toast)", async () => {
    const undo = vi.fn<(id: string) => Promise<UndoHistoryResult>>(async () => ({
      success: false,
      error: "No se pudo deshacer el cambio. Intentá de nuevo.",
    }));

    const action = buildUndoAction(undo, "hist-3");

    await expect(action()).rejects.toThrow("No se pudo deshacer el cambio. Intentá de nuevo.");
  });
});
