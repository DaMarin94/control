"use client";

/**
 * Diálogo de confirmación para eliminar un grupo de cuotas (RF-MC-002).
 *
 * Consume el shell compartido `ModalShell` (variant="dialog").
 * Advertencia de eliminación de grupo completo en bloque .warn (expense-soft).
 *
 * Lógica preservada intacta.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInstallments } from "@/hooks/use-installments";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { formatCurrency } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteInstallmentDialogProps {
  movement: MovementItem;
  onClose: () => void;
}

export function DeleteInstallmentDialog({ movement, onClose }: DeleteInstallmentDialogProps) {
  const { toast } = useToast();
  const { undo } = useUndoHistory();
  const { deleteInstallment, isDeleting } = useInstallments();

  async function handleConfirm() {
    const result = await deleteInstallment(movement.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento.");
      onClose();
      return;
    }

    if (result.historyEntryId) {
      toast.success(`Eliminado: ‘${description}’.`, {
        groupId: movement.id,
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

  const amountLabel = formatCurrency(movement.amountCents, movement.currency);
  const description = movement.description ?? movement.category.name;

  const installmentInfo = movement.installment
    ? `Cuota ${movement.installment.number}/${movement.installment.total}`
    : "Cuotas";

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="delete-installment-title">
      <ModalShellHeader titleId="delete-installment-title" title="Eliminar grupo de cuotas" />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          ¿Estás seguro de que querés eliminar este grupo de cuotas?
        </p>
        <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
          <p className="font-semibold text-ink">{description}</p>
          <p className="mt-0.5 text-muted mono">
            Gasto · {amountLabel} · {installmentInfo}
          </p>
        </div>

        {/* Advertencia grupo completo — bloque .warn */}
        <div
          className="flex items-start gap-[11px] rounded-ctl border px-[14px] py-[13px] bg-expense-soft"
          style={{ borderColor: "oklch(0.57 0.16 27 / 0.25)" }}
        >
          <AlertTriangle
            size={18}
            className="text-expense-ink shrink-0 mt-[1px]"
            aria-hidden="true"
          />
          <div className="text-[13px] leading-[1.45] text-expense-ink">
            <b className="font-bold">Se elimina el grupo completo.</b>{" "}
            Esta acción elimina{" "}
            <strong>todas las cuotas</strong> del grupo, incluyendo las ya pasadas y las
            futuras — no solo la del mes que estás viendo.
          </div>
        </div>

        <p className="text-[12.5px] text-muted">Vas a poder deshacerlo desde el historial.</p>
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
          {isDeleting ? "Eliminando..." : "Eliminar grupo"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
