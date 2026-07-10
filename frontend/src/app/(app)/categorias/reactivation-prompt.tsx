"use client";

/**
 * Diálogo de confirmación para reactivar una categoría eliminada.
 *
 * Consume el shell compartido `ModalShell` (variant="dialog", stacked — vive
 * en la misma capa que `CategoryFormModal`, al que reemplaza en el DOM sin
 * apilarse encima; docs/design.md §"Apilado de modales — gotcha de z-index").
 *
 * Lógica preservada intacta.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
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
    <ModalShell variant="dialog" stacked onClose={onCancel} labelledBy="reactivation-title">
      <ModalShellHeader titleId="reactivation-title" title="Categoría eliminada encontrada" />

      <ModalShellBody>
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
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isReactivating}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={handleReactivate} disabled={isReactivating}>
          {isReactivating ? "Reactivando..." : "Reactivar"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
