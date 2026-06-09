"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento fijo (RF-MF-004).
 *
 * Incluye un checkbox "Eliminar también desde este mes" (desmarcado por defecto).
 * - Desmarcado: el fijo deja de aparecer desde el mes siguiente (sigue en el mes actual).
 * - Marcado: el fijo deja de aparecer desde el mes actual inclusive.
 *
 * Los meses anteriores al actual nunca se modifican.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRecurring } from "@/hooks/use-recurring";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteRecurringDialogProps {
  /** MovementItem del fijo a eliminar (origin === "fijo") */
  movement: MovementItem;
  onClose: () => void;
}

export function DeleteRecurringDialog({ movement, onClose }: DeleteRecurringDialogProps) {
  const { toast } = useToast();
  const { deleteRecurring, isDeleting } = useRecurring();

  /** Checkbox "Eliminar también desde este mes" — desmarcado por defecto (RF-MF-004) */
  const [fromCurrentMonth, setFromCurrentMonth] = useState(false);

  async function handleConfirm() {
    const result = await deleteRecurring(movement.id, {
      currentMonth: getCurrentMonth(),
      fromCurrentMonth,
    });

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento.");
      onClose();
      return;
    }

    toast.success("Movimiento eliminado correctamente.");
    onClose();
  }

  const amountLabel = formatCurrency(movement.amountCents);
  const typeLabel = movement.type === "EXPENSE" ? "Gasto" : "Ingreso";
  const description = movement.description ?? movement.category.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-recurring-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 id="delete-recurring-title" className="text-lg font-semibold">
            Eliminar movimiento fijo
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <p className="text-sm text-foreground">
            ¿Estás seguro de que querés eliminar este movimiento fijo?
          </p>
          <div className="mt-3 rounded-md border bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{description}</p>
            <p className="mt-0.5 text-muted-foreground">
              {typeLabel} &middot; {amountLabel} &middot; Mensual
            </p>
          </div>

          {/* Checkbox de eliminación desde este mes (RF-MF-004) */}
          <label className="mt-4 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={fromCurrentMonth}
              onChange={(e) => setFromCurrentMonth(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary"
              aria-describedby="delete-recurring-checkbox-hint"
            />
            <span className="text-sm text-foreground">Eliminar también desde este mes</span>
          </label>
          <p
            id="delete-recurring-checkbox-hint"
            className="mt-1.5 pl-6 text-xs text-muted-foreground"
          >
            {fromCurrentMonth
              ? "El fijo dejará de aparecer desde el mes actual inclusive."
              : "El fijo seguirá visible este mes y dejará de aparecer a partir del mes siguiente."}
          </p>

          <p className="mt-3 text-xs text-muted-foreground">
            Los meses anteriores al actual no se modifican.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
