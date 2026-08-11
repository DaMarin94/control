/**
 * Puente entre `useUndoHistory()` (hooks/use-history.ts) y el contrato
 * `ToastAction["onClick"]` async del sistema de toasts (components/ui/toast.tsx).
 *
 * Traduce el resultado de `undo(historyEntryId)` al `ToastActionOutcome` que
 * espera el toast (docs/design.md §"Toast con acción — Deshacer inmediato"):
 *  - éxito → swap a `success` "Cambio deshecho." (mismo copy que /historial).
 *  - 404 (entrada ya no disponible) → swap a `warning` con el mensaje que ya
 *    resuelve `useUndoHistory` — no se reimplementa el mapeo, solo se
 *    distingue por el string exacto que ese hook ya devuelve.
 *  - cualquier otro error (red/5xx) → throw: dispara el camino de reintento
 *    del toast (acción restaurada + toast de error aparte).
 */

import type { ToastActionOutcome } from "@/components/ui/toast";
import type { UndoHistoryResult } from "@/hooks/use-history";

const OBSOLETE_MESSAGE = "Este cambio ya no está disponible para deshacer.";
const RETRY_MESSAGE = "No se pudo deshacer el cambio. Intentá de nuevo.";

/**
 * Construye el `onClick` async de la acción "Deshacer" de un toast.
 * `undo` es la función que devuelve `useUndoHistory()`.
 */
export function buildUndoAction(
  undo: (id: string) => Promise<UndoHistoryResult>,
  historyEntryId: string,
): () => Promise<ToastActionOutcome> {
  return async () => {
    const result = await undo(historyEntryId);

    if (result.success) {
      return { type: "success", message: "Cambio deshecho." };
    }

    if (result.error === OBSOLETE_MESSAGE) {
      return { type: "warning", message: OBSOLETE_MESSAGE };
    }

    throw new Error(result.error ?? RETRY_MESSAGE);
  };
}
