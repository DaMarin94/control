"use client";

/**
 * Diálogo de confirmación para eliminar una categoría (RF-CAT-004).
 *
 * Consume el shell compartido `ModalShell` (variant="dialog"): scrim, panel,
 * max-height y body-lock viven ahí.
 *
 * Lógica preservada intacta.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { type Category } from "@/types/category";

interface DeleteCategoryDialogProps {
  category: Category;
  onClose: () => void;
}

export function DeleteCategoryDialog({ category, onClose }: DeleteCategoryDialogProps) {
  const { toast } = useToast();
  const { deleteCategory, isDeleting } = useCategories();

  async function handleConfirm() {
    const result = await deleteCategory(category.id);

    if (!result.success) {
      toast.error(result.error ?? "No se pudo eliminar la categoría.");
      onClose();
      return;
    }

    toast.success(`Categoría "${category.name}" eliminada correctamente.`);
    onClose();
  }

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="delete-category-title">
      <ModalShellHeader titleId="delete-category-title" title="Eliminar categoría" />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          ¿Estás seguro de que querés eliminar la categoría{" "}
          <span className="font-semibold">&ldquo;{category.name}&rdquo;</span>?
        </p>
        {category.movementCount > 0 && (
          <p className="text-[13px] text-muted">
            Esta categoría tiene{" "}
            <span className="mono font-semibold text-ink">{category.movementCount}</span>{" "}
            {category.movementCount === 1 ? "movimiento asociado" : "movimientos asociados"}.
          </p>
        )}
        <p className="text-[12.5px] text-muted">
          La categoría dejará de estar disponible para nuevos movimientos. Los movimientos que ya
          la usan la conservan, y podés reactivarla más adelante si creás otra con el mismo
          nombre.
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
