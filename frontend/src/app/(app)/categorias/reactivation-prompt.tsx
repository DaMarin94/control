"use client";

/**
 * Diálogo de confirmación para reactivar una categoría eliminada.
 *
 * Se muestra cuando POST /categories devuelve 409 con error.data.reactivable === true.
 * Explica explícitamente que la categoría volverá con su configuración ORIGINAL
 * (mismo nombre, scope y color) — no con lo que el usuario escribió en el form.
 *
 * Acciones:
 * - Reactivar → llama a POST /categories/:id/reactivate, cierra todo al éxito.
 * - Cancelar → cierra el prompt y vuelve al formulario sin crear nada.
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
  /** Volver al formulario sin hacer nada */
  onCancel: () => void;
  /**
   * Llamado cuando la reactivación fue exitosa (para cerrar todo).
   * Recibe la categoría reactivada para que el padre pueda autoseleccionarla
   * cuando el prompt se usa en modo inline desde el formulario de movimiento (RF-MU-004).
   */
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
    // result.category siempre está presente en éxito; si por algún motivo no,
    // construimos un objeto mínimo desde los datos que ya tenemos en el prompt.
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactivation-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 id="reactivation-title" className="text-lg font-semibold">
            Categoría eliminada encontrada
          </h2>
        </div>

        {/* Cuerpo */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-foreground">
            Ya tenés una categoría{" "}
            <span className="font-semibold">&ldquo;{reactivable.name}&rdquo;</span> eliminada.
            ¿Querés reactivarla?
          </p>

          {/* Detalle de la configuración original */}
          <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm">
            <p className="mb-2 font-medium text-foreground">
              La categoría se reactivará con su configuración original:
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide">
                  Nombre
                </span>
                <span className="font-medium text-foreground">{reactivable.name}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide">
                  Tipo
                </span>
                <span className="font-medium text-foreground">{scopeLabel}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide">
                  Color
                </span>
                <span
                  className="inline-block h-4 w-4 rounded-full border"
                  style={{ backgroundColor: reactivable.color }}
                  aria-label={`Color: ${reactivable.color}`}
                />
                <span className="text-xs text-muted-foreground">{reactivable.color}</span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              El nombre y tipo que escribiste en el formulario no se aplicarán.
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isReactivating}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleReactivate} disabled={isReactivating}>
            {isReactivating ? "Reactivando..." : "Reactivar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
