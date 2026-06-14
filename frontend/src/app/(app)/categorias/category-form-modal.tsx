"use client";

/**
 * Modal de creación y edición de categorías (RF-CAT-002 / RF-CAT-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Scrim: fijo, ink/0.46 + blur(3px)
 * - Diálogo: max-width 380px, radio 18px, shadow-lg, animación modal-pop
 * - Scope picker: .scopepick (tres botones Ambos/Gasto/Ingreso, activo en accent)
 *
 * Lógica preservada intacta.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { type Category } from "@/types/category";
import { ReactivationPrompt } from "./reactivation-prompt";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").trim(),
  scope: z.enum(["BOTH", "EXPENSE", "INCOME"]),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// ─── Scope picker config ──────────────────────────────────────────────────────

const SCOPE_PICKER_OPTIONS = [
  { value: "BOTH", label: "Ambos" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
  lockScopeToType?: "EXPENSE" | "INCOME";
  onCreated?: (category: Category) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CategoryFormModal({
  category,
  onClose,
  lockScopeToType,
  onCreated,
}: CategoryFormModalProps) {
  const isEditing = category !== null;
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  const { createCategory, updateCategory, isCreating, isUpdating } = useCategories();

  // Estado para el prompt de reactivación
  const [reactivable, setReactivable] = useState<{
    id: string;
    name: string;
    scope: string;
    color: string;
  } | null>(null);

  const defaultScope = lockScopeToType ?? (category?.scope ?? "BOTH");

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      scope: defaultScope,
    },
  });

  // Sincronizar valores cuando cambia la categoría (al abrir en modo editar)
  useEffect(() => {
    reset({
      name: category?.name ?? "",
      scope: lockScopeToType ?? (category?.scope ?? "BOTH"),
    });
  }, [category, lockScopeToType, reset]);

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
      if (onCreated && result.category) {
        onCreated(result.category);
      }
      onClose();
    }
  }

  if (!mounted) return null;

  // Si hay un prompt de reactivación activo, renderizarlo
  if (reactivable) {
    return (
      <ReactivationPrompt
        reactivable={reactivable}
        onCancel={() => setReactivable(null)}
        onReactivated={(reactivatedCategory) => {
          setReactivable(null);
          if (onCreated) {
            onCreated(reactivatedCategory);
          }
          onClose();
        }}
      />
    );
  }

  // Opciones filtradas por lockScopeToType
  const visibleOptions = SCOPE_PICKER_OPTIONS.filter((opt) => {
    if (lockScopeToType === "EXPENSE") return opt.value !== "INCOME";
    if (lockScopeToType === "INCOME") return opt.value !== "EXPENSE";
    return true;
  });

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] pt-5 pb-4">
          <h2
            id="category-modal-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            {isEditing ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-[22px] pb-[22px] space-y-[14px]">
            {/* Campo nombre */}
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="cat-name" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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

            {/* Scope picker */}
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Alcance
              </Label>
              <Controller
                name="scope"
                control={control}
                render={({ field }) => (
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleOptions.length}, 1fr)` }}>
                    {visibleOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "text-[13px] font-semibold cursor-pointer px-2 py-[10px] rounded-ctl border transition-colors duration-[140ms]",
                          field.value === opt.value
                            ? "border-accent bg-accent-soft text-accent-ink"
                            : "border-line bg-panel text-muted hover:text-ink",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              />
              <p className="text-[12.5px] text-muted">
                Define si esta categoría aplica a gastos, ingresos o ambos.
              </p>
            </div>

            {/* Nota de color en modo editar */}
            {isEditing && (
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-3 py-2 text-[13px] text-muted">
                <span
                  className="inline-block h-4 w-4 shrink-0 rounded-chip border border-line"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                El color se asigna automáticamente y no se puede cambiar.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading
                ? isEditing ? "Guardando..." : "Creando..."
                : isEditing ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
