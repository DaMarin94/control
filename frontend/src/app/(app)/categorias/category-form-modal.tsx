"use client";

/**
 * Modal de creación y edición de categorías (RF-CAT-002 / RF-CAT-003).
 *
 * Modo crear: campos vacíos, llama a createCategory.
 * Modo editar: campos precargados con la categoría actual, llama a updateCategory.
 *
 * Manejo de 409 al crear:
 * - Sin error.data → colisión con activa → error en el campo nombre.
 * - Con error.data.reactivable === true → muestra ReactivationPrompt.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { type Category, SCOPE_OPTIONS } from "@/types/category";
import { ReactivationPrompt } from "./reactivation-prompt";

// ─── Schema ───────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").trim(),
  scope: z.enum(["BOTH", "EXPENSE", "INCOME"]),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFormModalProps {
  /** null = modo crear; Category = modo editar */
  category: Category | null;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CategoryFormModal({ category, onClose }: CategoryFormModalProps) {
  const isEditing = category !== null;
  const { toast } = useToast();
  const { createCategory, updateCategory, isCreating, isUpdating } = useCategories();

  // Estado para el prompt de reactivación
  const [reactivable, setReactivable] = useState<{
    id: string;
    name: string;
    scope: string;
    color: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      scope: category?.scope ?? "BOTH",
    },
  });

  // Sincronizar valores cuando cambia la categoría (al abrir en modo editar)
  useEffect(() => {
    reset({
      name: category?.name ?? "",
      scope: category?.scope ?? "BOTH",
    });
  }, [category, reset]);

  const isLoading = isEditing ? isUpdating : isCreating;

  async function onSubmit(data: CategoryFormData) {
    if (isEditing) {
      const result = await updateCategory(category.id, {
        name: data.name,
        scope: data.scope,
      });

      if (!result.success) {
        if (result.nameConflict) {
          setError("name", { message: "Ya existe una categoría activa con ese nombre." });
          return;
        }
        if (result.error) {
          toast.error(result.error);
        }
        return;
      }

      toast.success("Categoría actualizada correctamente.");
      onClose();
    } else {
      const result = await createCategory({
        name: data.name,
        scope: data.scope,
      });

      if (!result.success) {
        if (result.reactivable) {
          // Mostrar prompt de reactivación; no cerrar el modal aún
          setReactivable(result.reactivable);
          return;
        }
        if (result.nameConflict) {
          setError("name", { message: "Ya existe una categoría activa con ese nombre." });
          return;
        }
        if (result.error) {
          toast.error(result.error);
        }
        return;
      }

      toast.success("Categoría creada correctamente.");
      onClose();
    }
  }

  // Si hay un prompt de reactivación activo, renderizarlo sobre el modal
  if (reactivable) {
    return (
      <ReactivationPrompt
        reactivable={reactivable}
        onCancel={() => setReactivable(null)}
        onReactivated={() => {
          setReactivable(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="category-modal-title" className="text-lg font-semibold">
            {isEditing ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 py-5">
          {/* Campo nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" required>
              Nombre
            </Label>
            <Input
              id="cat-name"
              type="text"
              placeholder="Ej: Alimentación"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          {/* Campo scope */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-scope">Tipo</Label>
            <Select id="cat-scope" error={errors.scope?.message} {...register("scope")}>
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Define si esta categoría aplica a gastos, ingresos o ambos.
            </p>
          </div>

          {/* Nota: color no editable */}
          {isEditing && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span
                className="inline-block h-4 w-4 shrink-0 rounded-full border"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              El color se asigna automáticamente y no se puede cambiar.
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditing
                  ? "Guardando..."
                  : "Creando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear categoría"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
