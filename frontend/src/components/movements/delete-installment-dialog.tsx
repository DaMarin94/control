"use client";

/**
 * Diálogo de confirmación para eliminar un grupo de cuotas (RF-MC-002).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Misma estructura: scrim + diálogo DS.
 * Advertencia de eliminación de grupo completo en bloque .warn (expense-soft).
 *
 * Lógica preservada intacta.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInstallments } from "@/hooks/use-installments";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteInstallmentDialogProps {
  movement: MovementItem;
  onClose: () => void;
}

export function DeleteInstallmentDialog({ movement, onClose }: DeleteInstallmentDialogProps) {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { deleteInstallment, isDeleting } = useInstallments();

  useBodyScrollLock();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const amountLabel = formatCurrency(movement.amountCents, movement.currency);
  const description = movement.description ?? movement.category.name;

  const installmentInfo = movement.installment
    ? `Cuota ${movement.installment.number}/${movement.installment.total}`
    : "Cuotas";

  if (!mounted) return null;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-installment-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4 shrink-0">
          <h2
            id="delete-installment-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            Eliminar grupo de cuotas
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
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

          <p className="text-[12.5px] text-muted">Esta acción es permanente.</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2 shrink-0">
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
