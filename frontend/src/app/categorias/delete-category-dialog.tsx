"use client";

/**
 * Diálogo de confirmación para eliminar una categoría (RF-CAT-004).
 *
 * Pide confirmación antes de hacer el DELETE.
 * Al confirmar → llama a deleteCategory → refetch → toast de éxito.
 * Al cancelar → no hace nada y cierra el diálogo.
 */

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-category-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 id="delete-category-title" className="text-lg font-semibold">
            Eliminar categoría
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <p className="text-sm text-foreground">
            ¿Estás seguro de que querés eliminar la categoría{" "}
            <span className="font-semibold">&ldquo;{category.name}&rdquo;</span>?
          </p>
          {category.movementCount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Esta categoría tiene {category.movementCount}{" "}
              {category.movementCount === 1 ? "movimiento asociado" : "movimientos asociados"}.
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
