"use client";

/**
 * Diálogo de confirmación para eliminar un grupo de cuotas (RF-MC-002).
 *
 * Advierte explícitamente que se elimina el GRUPO COMPLETO (todas las cuotas,
 * no solo la del mes visible). Sin checkbox — la eliminación es siempre total.
 *
 * La eliminación es permanente: DELETE /installments/:id (hard delete).
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInstallments } from "@/hooks/use-installments";
import { formatCurrency } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteInstallmentDialogProps {
  /** MovementItem de la cuota a eliminar (origin === "cuota") */
  movement: MovementItem;
  onClose: () => void;
}

export function DeleteInstallmentDialog({ movement, onClose }: DeleteInstallmentDialogProps) {
  const { toast } = useToast();
  const { deleteInstallment, isDeleting } = useInstallments();

  async function handleConfirm() {
    const result = await deleteInstallment(movement.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento.");
      onClose();
      return;
    }

    toast.success("Movimiento eliminado correctamente.");
    onClose();
  }

  const amountLabel = formatCurrency(movement.amountCents);
  const description = movement.description ?? movement.category.name;

  // Información de cuota (ej: "Cuota 3/12 — desde 2026-01")
  const installmentInfo = movement.installment
    ? `Cuota ${movement.installment.number}/${movement.installment.total}`
    : "Cuotas";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-installment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 id="delete-installment-title" className="text-lg font-semibold">
            Eliminar grupo de cuotas
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <p className="text-sm text-foreground">
            ¿Estás seguro de que querés eliminar este grupo de cuotas?
          </p>
          <div className="mt-3 rounded-md border bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{description}</p>
            <p className="mt-0.5 text-muted-foreground">
              Gasto &middot; {amountLabel} &middot; {installmentInfo}
            </p>
          </div>

          {/* Advertencia explícita — grupo completo (RF-MC-002) */}
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <p className="font-semibold">Se elimina el grupo completo</p>
            <p className="mt-1">
              Esta acción elimina <strong>todas las cuotas</strong> del grupo, incluyendo las ya
              pasadas y las futuras — no solo la del mes que estás viendo.
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">Esta acción es permanente.</p>
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
            {isDeleting ? "Eliminando..." : "Eliminar grupo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
