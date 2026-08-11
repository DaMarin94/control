"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento único (RF-MU-003).
 *
 * Consume el shell compartido `ModalShell` (variant="dialog").
 *
 * Lógica preservada intacta.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTransactions } from "@/hooks/use-transactions";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
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
  const { undo } = useUndoHistory();
  const { deleteTransaction, isDeleting } = useTransactions();

  async function handleConfirm() {
    const month = transaction.occurredAt.substring(0, 7);
    const result = await deleteTransaction(transaction.id, month);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento.");
      onClose();
      return;
    }

    if (result.historyEntryId) {
      toast.success(`Eliminado: ‘${description}’.`, {
        groupId: transaction.id,
        action: {
          label: "Deshacer",
          pendingLabel: "Deshaciendo…",
          onClick: buildUndoAction(undo, result.historyEntryId),
        },
      });
    } else {
      toast.success(`Eliminado: ‘${description}’.`);
    }
    onClose();
  }

  const amountLabel = formatCurrency(transaction.amountCents, transaction.currency);
  const typeLabel = transaction.type === "EXPENSE" ? "Gasto" : "Ingreso";
  const description = transaction.description ?? transaction.category.name;

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="delete-transaction-title">
      <ModalShellHeader titleId="delete-transaction-title" title="Eliminar movimiento" />

      <ModalShellBody>
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
          Vas a poder deshacerlo desde el historial.
        </p>
      </ModalShellBody>

      <ModalShellFooter>
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
      </ModalShellFooter>
    </ModalShell>
  );
}
