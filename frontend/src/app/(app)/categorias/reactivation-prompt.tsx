"use client";

/**
 * Diálogo de confirmación para reactivar una categoría eliminada.
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Misma estructura visual que DeleteCategoryDialog: scrim + diálogo DS.
 *
 * Lógica preservada intacta.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { SCOPE_LABELS, type CategoryScope, type Category } from "@/types/category";

interface ReactivationPromptProps {
  reactivable: {
    id: string;
    name: string;
    scope: string;
    color: string;
  };
  onCancel: () => void;
  onReactivated: (category: Category) => void;
}

export function ReactivationPrompt({ reactivable, onCancel, onReactivated }: ReactivationPromptProps) {
  const { toast } = useToast();
  const { reactivateCategory, isReactivating } = useCategories();

  const scopeLabel = SCOPE_LABELS[reactivable.scope as CategoryScope] ?? reactivable.scope;

  async function handleReactivate() {
    const result = await reactivateCategory(reactivable.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo reactivar la categoría.");
      return;
    }

    toast.success(`Categoría "${reactivable.name}" reactivada correctamente.`);
    const reactivated: Category = result.category ?? {
      id: reactivable.id,
      name: reactivable.name,
      scope: reactivable.scope as CategoryScope,
      color: reactivable.color,
      userId: "",
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      movementCount: 0,
    };
    onReactivated(reactivated);
  }

  return (
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactivation-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[440px] bg-panel border border-line overflow-hidden animate-modal-pop"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4">
          <h2
            id="reactivation-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            Categoría eliminada encontrada
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-[22px] pb-[22px] space-y-[14px]">
          <p className="text-[14px] text-ink">
            Ya tenés una categoría{" "}
            <span className="font-semibold">&ldquo;{reactivable.name}&rdquo;</span> eliminada.
            ¿Querés reactivarla?
          </p>

          {/* Detalle de configuración original */}
          <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
            <p className="mb-2 font-semibold text-ink">
              La categoría se reactivará con su configuración original:
            </p>
            <ul className="space-y-1 text-muted">
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Nombre
                </span>
                <span className="font-semibold text-ink">{reactivable.name}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Tipo
                </span>
                <span className="font-semibold text-ink">{scopeLabel}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Color
                </span>
                <span
                  className="inline-block h-4 w-4 rounded-chip border border-line"
                  style={{ backgroundColor: reactivable.color }}
                  aria-label={`Color: ${reactivable.color}`}
                />
                <span className="text-[12px] text-faint">{reactivable.color}</span>
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-muted">
              El nombre y tipo que escribiste en el formulario no se aplicarán.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isReactivating}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleReactivate} disabled={isReactivating}>
            {isReactivating ? "Reactivando..." : "Reactivar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
