"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento fijo (RF-MF-004).
 *
 * El fijo se elimina desde el mes visualizado (viewMonth) en adelante, inclusive.
 * Los meses anteriores al mes visualizado no se modifican.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRecurring } from "@/hooks/use-recurring";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteRecurringDialogProps {
  /** MovementItem del fijo a eliminar (origin === "fijo") */
  movement: MovementItem;
  onClose: () => void;
  /** Mes que el usuario está viendo (YYYY-MM). Si se omite, se usa el mes actual. */
  viewMonth?: string;
}

export function DeleteRecurringDialog({ movement, onClose, viewMonth }: DeleteRecurringDialogProps) {
  const { toast } = useToast();
  const { deleteRecurring, isDeleting } = useRecurring();

  async function handleConfirm() {
    const result = await deleteRecurring(movement.id, {
      currentMonth: viewMonth ?? getCurrentMonth(),
      fromCurrentMonth: true,
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

          <p className="mt-4 text-xs text-muted-foreground">
            El fijo se eliminará desde este mes en adelante. Los meses anteriores no se modifican.
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
