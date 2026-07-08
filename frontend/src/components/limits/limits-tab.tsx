"use client";

/**
 * LimitsTab — contenido de la solapa "Límites" de /configuracion (docs/design.md
 * §"Panel de gestión de límites" → 2. "Solapa Límites — encabezado y lista").
 *
 * v1 (D8): crear / listar / borrar, toggle `enabled`. Sin editar.
 */

import { useState } from "react";
import { Plus, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLimits } from "@/hooks/use-limits";
import { useCategories } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { LimitRow } from "@/components/limits/limit-row";
import { CreateLimitModal } from "@/components/limits/create-limit-modal";
import { SkeletonBlock } from "@/components/ui/skeleton";

export function LimitsTab() {
  const { limits, setEnabled, remove, isLoading } = useLimits();
  const { categories } = useCategories();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleToggle(id: string, enabled: boolean) {
    const result = await setEnabled(id, enabled);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo actualizar el límite.");
    }
  }

  async function handleRemove(id: string) {
    const result = await remove(id);
    if (result.success) {
      toast.success("Límite eliminado.");
    } else {
      toast.error(result.error ?? "No se pudo eliminar el límite.");
    }
  }

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      {/* Sub-encabezado del panel */}
      <div className="flex items-center justify-between gap-6 mb-4">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">Límites</p>
          <p className="text-[12.5px] font-medium text-muted mt-[2px]">
            Resaltá un dato cuando cruza un umbral que definís.
          </p>
        </div>
        <Button type="button" onClick={() => setModalOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Nuevo límite
        </Button>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Cargando límites">
          <SkeletonBlock height={80} />
        </div>
      ) : limits.length === 0 ? (
        // Estado vacío — coherente con la restricción rectora: sin límites, ni la
        // app ni el panel muestran marca alguna.
        <div className="flex flex-col items-center text-center gap-3 rounded-[14px] border border-line bg-panel px-6 py-10 shadow-[var(--shadow-sm)]">
          <Gauge size={28} className="text-faint" aria-hidden="true" />
          <div>
            <p className="text-[14.5px] font-semibold text-ink">Todavía no creaste límites</p>
            <p className="text-[13px] font-medium text-muted mt-1 max-w-[360px]">
              Creá un límite y Control resaltará ese dato cuando cruce el umbral que definas.
            </p>
          </div>
          <Button type="button" onClick={() => setModalOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Nuevo límite
          </Button>
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)] overflow-hidden">
          {limits.map((limit, index) => (
            <div key={limit.id} className={index > 0 ? "border-t border-hair" : ""}>
              <LimitRow
                limit={limit}
                categoryName={
                  limit.refinement?.categoryId ? categoryNameById.get(limit.refinement.categoryId) : undefined
                }
                onToggleEnabled={(enabled) => handleToggle(limit.id, enabled)}
                onRemove={() => handleRemove(limit.id)}
              />
            </div>
          ))}
        </div>
      )}

      {modalOpen && <CreateLimitModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
