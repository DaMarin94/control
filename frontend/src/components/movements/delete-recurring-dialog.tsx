"use client";

/**
 * Diálogo de confirmación para eliminar un movimiento fijo (RF-MF-004)
 * o un calculado de origen único/cuota.
 *
 * - variant="fijo" (default): copy específico de fijo ("desde este mes en adelante").
 * - variant="calculated-simple": confirmación directa para calculados de único/cuota
 *   ("¿Eliminar este movimiento calculado?"). Sin copy de recurrencia.
 *
 * En ambas variantes: fromCurrentMonth=true hardcodeado, viewMonth como currentMonth.
 * El backend ignora currentMonth/fromCurrentMonth para calculados de único/cuota.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRecurring } from "@/hooks/use-recurring";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import type { MovementItem } from "@/types/movement";

interface DeleteRecurringDialogProps {
  /** MovementItem a eliminar */
  movement: MovementItem;
  onClose: () => void;
  /** Mes visualizado en la Vista del mes (YYYY-MM). Fallback: mes actual del navegador. */
  viewMonth?: string;
  /**
   * "fijo" (default): diálogo específico para fijos (con copy de recurrencia).
   * "calculated-simple": confirmación directa para calculados de único/cuota.
   */
  variant?: "fijo" | "calculated-simple";
}

export function DeleteRecurringDialog({ movement, onClose, viewMonth, variant = "fijo" }: DeleteRecurringDialogProps) {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { deleteRecurring, isDeleting } = useRecurring();

  useBodyScrollLock();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const amountLabel = formatCurrency(movement.amountCents, movement.currency);
  const typeLabel = movement.type === "EXPENSE" ? "Gasto" : "Ingreso";
  const description = movement.description ?? movement.category.name;

  const isCalculatedSimple = variant === "calculated-simple";
  const dialogTitleId = isCalculatedSimple
    ? "delete-calculated-simple-title"
    : "delete-recurring-title";

  if (!mounted) return null;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4 shrink-0">
          <h2
            id={dialogTitleId}
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            {isCalculatedSimple ? "Eliminar movimiento calculado" : "Eliminar movimiento fijo"}
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
          <p className="text-[14px] text-ink">
            {isCalculatedSimple
              ? "¿Estás seguro de que querés eliminar este movimiento calculado?"
              : "¿Estás seguro de que querés eliminar este movimiento fijo?"}
          </p>
          <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
            <p className="font-semibold text-ink">{description}</p>
            <p className="mt-0.5 text-muted mono">
              {isCalculatedSimple
                ? `${typeLabel} · ${amountLabel} · Calculado`
                : `${typeLabel} · ${amountLabel} · Mensual`}
            </p>
          </div>
          {isCalculatedSimple ? (
            <p className="text-[12.5px] text-muted">
              Esta acción es permanente y no se puede deshacer.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted">
                El fijo dejará de aparecer desde este mes en adelante. Los meses anteriores no se modifican.
              </p>
              {movement.hasCalculated && (
                <div
                  className="rounded-ctl px-3 py-2.5 flex items-start gap-2.5"
                  style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)" }}
                >
                  <AlertTriangle
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                    style={{ color: "var(--warning-ink)", flexShrink: 0, marginTop: "1px" }}
                  />
                  <p className="text-[13px] font-medium leading-snug m-0" style={{ color: "var(--warning-ink)" }}>
                    Este movimiento fijo tiene movimientos calculados que dependen de él. Si lo eliminás, esos calculados también se eliminarán.
                  </p>
                </div>
              )}
            </>
          )}
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
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
