"use client";

/**
 * Diálogo de confirmación para eliminar una simulación de categoría
 * (docs/design.md "Simulación de categoría (`/mes`)" §4, RF-SIM-004). Misma
 * caja de identidad que el diálogo de eliminar un movimiento, pero esta
 * eliminación es un borrado físico: no genera entrada de historial y no es
 * deshacible (excepción explícita a RN-027, RF-SIM-004).
 */

import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { useToast } from "@/hooks/use-toast";
import { useDeleteSimulation } from "@/hooks/use-simulations";
import type { SimulationDto } from "@/types/simulation";

interface DeleteSimulationDialogProps {
  simulation: SimulationDto;
  onClose: () => void;
}

export function DeleteSimulationDialog({ simulation, onClose }: DeleteSimulationDialogProps) {
  const { toast } = useToast();
  const { deleteSimulation, isDeleting } = useDeleteSimulation();

  async function handleConfirm() {
    const result = await deleteSimulation(simulation.id);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar la simulación.");
      return;
    }
    toast.success("Simulación eliminada.");
    onClose();
  }

  const categoryName = simulation.category.name;

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="delete-simulation-title">
      <ModalShellHeader titleId="delete-simulation-title" title="Eliminar simulación" />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          Se va a eliminar la simulación de <strong>{categoryName}</strong>.
        </p>
        <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 flex items-center gap-[8px]">
          <span
            className="h-[8px] w-[8px] rounded-full shrink-0"
            style={{ background: simulation.category.color }}
            aria-hidden="true"
          />
          <span className="text-[13px] font-semibold text-ink">{categoryName}</span>
        </div>
        <p className="text-[12.5px] text-muted">
          Sus movimientos simulados dejan de aparecer en los meses futuros y los totales se recalculan sin ellos.
        </p>
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={handleConfirm} disabled={isDeleting}>
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
