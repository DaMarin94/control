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
 *
 * Consume el shell compartido `ModalShell` (variant="dialog" del shell —
 * distinto de la prop `variant` de este componente, que es de contenido).
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRecurring } from "@/hooks/use-recurring";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
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
  const { toast } = useToast();
  const { undo } = useUndoHistory();
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

    if (result.historyEntryId) {
      // Identidad de grupo del toast — DEBE coincidir con la que usa el form
      // de edición del mismo movimiento (invariante RN-024: el toast de
      // edición y el de borrado tienen que compartir groupId, o el segundo
      // no reemplaza al primero y quedan dos toasts apilados):
      // - variant="fijo" (fijo normal Y calculado de fijo, ambos origin==="fijo"):
      //   el id de fila puede cambiar por split de edición → usar el chainId
      //   propio del ítem (siempre presente para origin==="fijo"), igual que
      //   RecurringForm/CalculatedForm en edición.
      // - variant="calculated-simple" (calculado de único/cuota): edita
      //   SIEMPRE in-place (sin split) → su id de fila es estable y coincide
      //   con el que usa CalculatedForm en edición para el mismo movimiento.
      const groupId = variant === "fijo" ? movement.chainId! : movement.id;
      toast.success(`Eliminado: ‘${description}’.`, {
        groupId,
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
  const typeLabel = movement.type === "EXPENSE" ? "Gasto" : "Ingreso";
  const description = movement.description ?? movement.category.name;

  const isCalculatedSimple = variant === "calculated-simple";
  const dialogTitleId = isCalculatedSimple
    ? "delete-calculated-simple-title"
    : "delete-recurring-title";

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={dialogTitleId}>
      <ModalShellHeader
        titleId={dialogTitleId}
        title={isCalculatedSimple ? "Eliminar movimiento calculado" : "Eliminar movimiento fijo"}
      />

      <ModalShellBody>
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
            Vas a poder deshacerlo desde el historial.
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
