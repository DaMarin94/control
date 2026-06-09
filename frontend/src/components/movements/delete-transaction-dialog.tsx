"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento (RF-MU-003).
 *
 * Eliminación hard delete permanente — no hay papelera ni soft delete.
 * Pide confirmación explícita antes de ejecutar el DELETE.
 *
 * Props:
 * - transaction: movimiento a eliminar (necesario para mostrar descripción y el mes para invalidar)
 * - onClose: llamado al cancelar o al finalizar la eliminación
 *
 * Fase 5 cableará este diálogo desde la Vista del mes.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTransactions } from "@/hooks/use-transactions";
import { type Transaction } from "@/types/transaction";
import { formatCurrency } from "@/lib/format";

interface DeleteTransactionDialogProps {
  transaction: Transaction;
  onClose: () => void;
}

export function DeleteTransactionDialog({
  transaction,
  onClose,
}: DeleteTransactionDialogProps) {
  const { toast } = useToast();
  const { deleteTransaction, isDeleting } = useTransactions();

  async function handleConfirm() {
    // El mes se deriva del occurredAt para invalidar la query correcta
    const month = transaction.occurredAt.substring(0, 7);
    const result = await deleteTransaction(transaction.id, month);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento.");
      onClose();
      return;
    }

    toast.success("Movimiento eliminado correctamente.");
    onClose();
  }

  const amountLabel = formatCurrency(transaction.amountCents);
  const typeLabel = transaction.type === "EXPENSE" ? "Gasto" : "Ingreso";
  const description = transaction.description ?? transaction.category.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-transaction-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 id="delete-transaction-title" className="text-lg font-semibold">
            Eliminar movimiento
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <p className="text-sm text-foreground">
            ¿Estás seguro de que querés eliminar este movimiento?
          </p>
          <div className="mt-3 rounded-md border bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{description}</p>
            <p className="mt-0.5 text-muted-foreground">
              {typeLabel} &middot; {amountLabel}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Esta acción es permanente y no se puede deshacer.
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
