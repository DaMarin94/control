"use client";

/**
 * Formulario de movimiento fijo (RF-MF-001 / RF-MF-003).
 *
 * Modo crear: campos con defaults (tipo=EXPENSE, sin fecha).
 * Modo editar: campos precargados; tipo es read-only (RF-MF-003 no permite editar el type).
 *
 * Reglas de negocio:
 * - Monto en pesos, convertido a centavos al enviar (parseCurrencyInput).
 * - Categorías filtradas por scope según el tipo (RN-010).
 * - Si cambia el tipo (solo en crear) y la categoría deja de ser compatible, se resetea.
 * - Sin fecha ni hora — los fijos son ítems mensuales sin día específico.
 * - startMonth = getCurrentMonth() (mes actual del navegador, solo al crear).
 * - Al editar: PATCH con currentMonth = getCurrentMonth(); type y startMonth no se envían.
 * - Error del backend → modal queda abierto con datos conservados (RNF-008).
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { useRecurring } from "@/hooks/use-recurring";
import { useToast } from "@/hooks/use-toast";
import { type TransactionType } from "@/types/transaction";
import { type CategoryScope } from "@/types/category";
import { type Recurring } from "@/types/recurring";
import { parseCurrencyInput, getCurrentMonth } from "@/lib/format";
import { useRouter } from "next/navigation";

// ─── Schema ───────────────────────────────────────────────────────────────────

const recurringSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
  categoryId: z.string().min(1, "La categoría es requerida"),
  description: z.string().optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecurringFormProps {
  /**
   * null = modo crear.
   * Recurring = modo editar (type es read-only).
   */
  recurring: Recurring | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve las categorías compatibles con el tipo dado (RN-010) */
function filterCategoriesByType(
  categories: { id: string; name: string; scope: CategoryScope }[],
  type: TransactionType,
) {
  return categories.filter((cat) => {
    if (type === "EXPENSE") return cat.scope === "EXPENSE" || cat.scope === "BOTH";
    return cat.scope === "INCOME" || cat.scope === "BOTH";
  });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function RecurringForm({ recurring, onClose }: RecurringFormProps) {
  const isEditing = recurring !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createRecurring, updateRecurring, isCreating, isUpdating } = useRecurring();

  const isLoading = isEditing ? isUpdating : isCreating;

  const defaultValues: RecurringFormData = isEditing
    ? {
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        categoryId: recurring.categoryId,
        description: recurring.description ?? "",
      }
    : {
        type: "EXPENSE",
        amountInput: "",
        categoryId: "",
        description: "",
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues,
  });

  // Sincronizar cuando cambia el fijo (abrir en modo editar)
  useEffect(() => {
    if (isEditing) {
      reset({
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        categoryId: recurring.categoryId,
        description: recurring.description ?? "",
      });
    }
  }, [recurring, isEditing, reset]);

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

  // Categorías disponibles filtradas por tipo
  const availableCategories = filterCategoriesByType(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    selectedType,
  );

  // Si cambia el tipo (solo en crear) y la categoría deja de ser compatible → resetear
  useEffect(() => {
    if (!isEditing && selectedCategoryId && categories) {
      const isCompatible = availableCategories.some((c) => c.id === selectedCategoryId);
      if (!isCompatible) {
        setValue("categoryId", "");
      }
    }
  }, [isEditing, selectedType, categories, selectedCategoryId, availableCategories, setValue]);

  const noCategoriesAvailable = availableCategories.length === 0;

  async function onSubmit(data: RecurringFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return; // Zod ya valida esto

    if (isEditing) {
      const result = await updateRecurring(recurring.id, {
        currentMonth: getCurrentMonth(),
        amountCents,
        categoryId: data.categoryId,
        description: data.description || null,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      toast.success("Movimiento actualizado correctamente.");
      onClose();
    } else {
      const startMonth = getCurrentMonth();

      const result = await createRecurring({
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        startMonth,
        description: data.description || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      // Toast con acción "Ir a ver" → /mes?month=YYYY-MM del mes actual (RF-MF-001)
      toast.success("Movimiento guardado correctamente.", {
        action: {
          label: "Ir a ver",
          onClick: () => router.push(`/mes?month=${startMonth}`),
        },
      });

      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 py-5">
      {/* ── Tipo ── */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-type" required>
          Tipo
        </Label>
        {isEditing ? (
          /* En edición el tipo es read-only (RF-MF-003) */
          <div className="flex items-center gap-2">
            <Input
              id="rec-type"
              type="text"
              value={recurring.type === "EXPENSE" ? "Gasto" : "Ingreso"}
              disabled
              className="bg-muted/50 text-muted-foreground"
            />
            {/* Campo oculto para que react-hook-form lo tenga en el form state */}
            <input type="hidden" {...register("type")} />
          </div>
        ) : (
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                id="rec-type"
                value={field.value}
                onChange={field.onChange}
                error={errors.type?.message}
              >
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
              </Select>
            )}
          />
        )}
      </div>

      {/* ── Monto ── */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-amount" required>
          Monto ($)
        </Label>
        <Input
          id="rec-amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          error={errors.amountInput?.message}
          {...register("amountInput")}
        />
        <p className="text-xs text-muted-foreground">Ingresá el monto en pesos (ej: 1500,50)</p>
      </div>

      {/* ── Categoría ── */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-category" required>
          Categoría
        </Label>
        {noCategoriesAvailable ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No hay categorías disponibles para este tipo de movimiento.{" "}
            <Link
              href="/categorias"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Creá una categoría
            </Link>
            .
          </div>
        ) : (
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select
                id="rec-category"
                value={field.value}
                onChange={field.onChange}
                error={errors.categoryId?.message}
              >
                <option value="">Seleccioná una categoría</option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            )}
          />
        )}
      </div>

      {/* ── Descripción ── */}
      <div className="space-y-1.5">
        <Label htmlFor="rec-description">Descripción</Label>
        <Input
          id="rec-description"
          type="text"
          placeholder="Opcional"
          error={errors.description?.message}
          {...register("description")}
        />
      </div>

      {/* ── Acciones ── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || noCategoriesAvailable}>
          {isLoading
            ? "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
