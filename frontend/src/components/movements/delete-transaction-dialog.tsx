"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento único (RF-MU-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Misma estructura: scrim + diálogo max-width 380px, radio 18px, shadow-lg, modal-pop.
 *
 * Lógica preservada intacta.
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
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-transaction-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4">
          <h2
            id="delete-transaction-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            Eliminar movimiento
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-[22px] pb-[22px] space-y-[14px]">
          <p className="text-[14px] text-ink">
            ¿Estás seguro de que querés eliminar este movimiento?
          </p>
          <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
            <p className="font-semibold text-ink">{description}</p>
            <p className="mt-0.5 text-muted mono">
              {typeLabel} · {amountLabel}
            </p>
          </div>
          <p className="text-[12.5px] text-muted">
            Esta acción es permanente y no se puede deshacer.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
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
