"use client";

/**
 * Diálogo de confirmación para eliminar una categoría (RF-CAT-004).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Scrim: fijo, ink/0.46 + blur(3px)
 * - Diálogo: max-width ~380px, radio 18px, shadow-lg, animación modal-pop
 *
 * Lógica preservada intacta.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { type Category } from "@/types/category";

interface DeleteCategoryDialogProps {
  category: Category;
  onClose: () => void;
}

export function DeleteCategoryDialog({ category, onClose }: DeleteCategoryDialogProps) {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const { deleteCategory, isDeleting } = useCategories();

  useBodyScrollLock();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-category-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4 shrink-0">
          <h2
            id="delete-category-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            Eliminar categoría
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
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
