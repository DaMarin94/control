"use client";

/**
 * Diálogo de confirmación para eliminar un método de pago (RF-PM-003).
 * Espejo 1:1 de delete-category-dialog.tsx.
 *
 * Consume el shell compartido `ModalShell` (variant="dialog").
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { type PaymentMethod } from "@/types/payment-method";

interface DeletePaymentMethodDialogProps {
  paymentMethod: PaymentMethod;
  onClose: () => void;
}

export function DeletePaymentMethodDialog({ paymentMethod, onClose }: DeletePaymentMethodDialogProps) {
  const { toast } = useToast();
  const { deletePaymentMethod, isDeleting } = usePaymentMethods();

  async function handleConfirm() {
    const result = await deletePaymentMethod(paymentMethod.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar el método de pago.");
      onClose();
      return;
    }

    toast.success(`Método de pago "${paymentMethod.name}" eliminado correctamente.`);
    onClose();
  }

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="delete-payment-method-title">
      <ModalShellHeader titleId="delete-payment-method-title" title="Eliminar método de pago" />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          ¿Estás seguro de que querés eliminar el método de pago{" "}
          <span className="font-semibold">&ldquo;{paymentMethod.name}&rdquo;</span>?
        </p>
        {paymentMethod.movementCount > 0 && (
          <p className="text-[13px] text-muted">
            Este método tiene{" "}
            <span className="mono font-semibold text-ink">{paymentMethod.movementCount}</span>{" "}
            {paymentMethod.movementCount === 1 ? "movimiento asociado" : "movimientos asociados"}.
            Conservarán la referencia.
          </p>
        )}
        <p className="text-[12.5px] text-muted">
          Podés reactivarlo más adelante si creás otro con el mismo nombre.
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
