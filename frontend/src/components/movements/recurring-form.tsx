"use client";

/**
 * Formulario de movimiento fijo (RF-MF-001 / RF-MF-003).
 *
 * Modo crear: campos con defaults (tipo=EXPENSE, mes de inicio editable).
 * Modo editar: campos precargados; tipo es read-only (RF-MF-003 no permite editar el type).
 *
 * Reglas de negocio:
 * - Monto en pesos, convertido a centavos al enviar (parseCurrencyInput).
 * - Categorías filtradas por scope según el tipo (RN-010).
 * - Si cambia el tipo (solo en crear) y la categoría deja de ser compatible, se resetea.
 * - Sin fecha ni hora — los fijos son ítems mensuales sin día específico.
 * - startMonth: campo editable en modo crear (<input type="month">);
 *   default = defaultMonth (mes navegado) ?? getCurrentMonth() (mes actual del navegador).
 *   Permite pasado — no hay validación de mes mínimo.
 * - Al editar: PATCH con currentMonth = viewMonth ?? getCurrentMonth().
 *   viewMonth es el mes que el usuario está viendo en la Vista del mes; permite
 *   que el split del backend corte en el mes correcto al editar desde un mes pasado
 *   o futuro. Si el form se abre desde un contexto sin mes navegado (ej. dashboard),
 *   el fallback getCurrentMonth() garantiza compatibilidad. type y startMonth no se envían.
 * - Error del backend → modal queda abierto con datos conservados (RNF-008).
 */

import { useEffect, useState } from "react";
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
import { type Category, type CategoryScope } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/categorias/category-form-modal";
import { type Recurring } from "@/types/recurring";
import { parseCurrencyInput, getCurrentMonth } from "@/lib/format";
import { createLogger } from "@/lib/logger";
import { useRouter } from "next/navigation";

const logger = createLogger("RecurringForm");

// ─── Schema ───────────────────────────────────────────────────────────────────

const recurringSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
  startMonth: z
    .string()
    .min(1, "El mes de inicio es requerido")
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
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
  /**
   * Mes contexto (YYYY-MM) desde la Vista del mes.
   * Solo aplica en modo crear: es el default del campo "Mes de inicio".
   * Si no se pasa, el default es el mes actual del navegador.
   */
  defaultMonth?: string;
  /**
   * Mes navegado (YYYY-MM) desde la Vista del mes.
   * Solo aplica en modo editar: se usa como currentMonth en el PATCH,
   * para que el split del backend corte en el mes que el usuario está viendo.
   * Si no se pasa, se cae al getCurrentMonth() (mes real de hoy).
   */
  viewMonth?: string;
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

export function RecurringForm({ recurring, onClose, defaultMonth, viewMonth }: RecurringFormProps) {
  const isEditing = recurring !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createRecurring, updateRecurring, isCreating, isUpdating } = useRecurring();

  // Estado del modal inline de nueva categoría (RF-MU-004)
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const isLoading = isEditing ? isUpdating : isCreating;

  const defaultValues: RecurringFormData = isEditing
    ? {
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        // En edición, startMonth no se muestra ni se envía en el PATCH.
        // El mapper (movementItemToRecurring) setea "" porque el MovementItem
        // de la lista no trae el startMonth real. Usamos getCurrentMonth() como
        // valor de relleno válido solo para satisfacer el schema compartido.
        startMonth: getCurrentMonth(),
        categoryId: recurring.categoryId,
        description: recurring.description ?? "",
      }
    : {
        type: "EXPENSE",
        amountInput: "",
        startMonth: defaultMonth ?? getCurrentMonth(),
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
        // Mismo relleno que en defaultValues: getCurrentMonth() satisface el
        // schema compartido; este campo no se renderiza ni se envía en el PATCH.
        startMonth: getCurrentMonth(),
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
        // viewMonth es el mes que el usuario está viendo en la Vista del mes.
        // Usarlo como pivote permite que el backend corte el fijo en el mes correcto.
        // Fallback a getCurrentMonth() si el form se abre desde un contexto sin mes navegado.
        currentMonth: viewMonth ?? getCurrentMonth(),
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
      const result = await createRecurring({
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        startMonth: data.startMonth,
        description: data.description || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      // Toast con acción "Ir a ver" → /mes?month=startMonth elegido (RF-MF-001)
      toast.success("Movimiento guardado correctamente.", {
        action: {
          label: "Ir a ver",
          onClick: () => router.push(`/mes?month=${data.startMonth}`),
        },
      });

      onClose();
    }
  }

  return (
    <>
    <form
      onSubmit={handleSubmit(onSubmit, (errors) => {
        logger.warn("Validación del form de fijo falló", { errors });
      })}
      noValidate
      className="space-y-4 px-6 py-5"
    >
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

      {/* ── Mes de inicio (solo en modo crear) ── */}
      {!isEditing && (
        <div className="space-y-1.5">
          <Label htmlFor="rec-start-month" required>
            Mes de inicio
          </Label>
          <Input
            id="rec-start-month"
            type="month"
            error={errors.startMonth?.message}
            {...register("startMonth")}
          />
          <p className="text-xs text-muted-foreground">
            Mes a partir del cual aparece este gasto fijo
          </p>
        </div>
      )}

      {/* ── Categoría ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="rec-category" required>
            Categoría
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCategoryModal(true)}
            className="h-auto py-0.5 text-xs text-primary hover:text-primary/80"
          >
            + Nueva
          </Button>
        </div>
        {noCategoriesAvailable ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No hay categorías disponibles para este tipo de movimiento.{" "}
            <Link
              href="/categorias"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Creá una categoría
            </Link>{" "}
            o usá el botón &ldquo;+ Nueva&rdquo; de arriba.
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

      {/* ── Modal inline de nueva categoría (RF-MU-004) ── */}
      {/* Se renderiza como hermano del form (no descendiente) para evitar un
          <form> anidado dentro de otro <form>, que es HTML inválido y rompe
          la hidratación de React. */}
      {showCategoryModal && (
        <CategoryFormModal
          category={null}
          lockScopeToType={selectedType}
          onClose={() => setShowCategoryModal(false)}
          onCreated={(cat: Category) => {
            setValue("categoryId", cat.id);
            setShowCategoryModal(false);
          }}
        />
      )}
    </>
  );
}
