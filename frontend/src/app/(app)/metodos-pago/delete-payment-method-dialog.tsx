"use client";

/**
 * Diálogo de confirmación para eliminar un método de pago (RF-PM-003).
 * Espejo 1:1 de delete-category-dialog.tsx.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { type PaymentMethod } from "@/types/payment-method";

interface DeletePaymentMethodDialogProps {
  paymentMethod: PaymentMethod;
  onClose: () => void;
}

export function DeletePaymentMethodDialog({ paymentMethod, onClose }: DeletePaymentMethodDialogProps) {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { deletePaymentMethod, isDeleting } = usePaymentMethods();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-payment-method-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4">
          <h2
            id="delete-payment-method-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            Eliminar método de pago
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-[22px] pb-[22px] space-y-[14px]">
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
    </div>,
    document.body,
  );
}
