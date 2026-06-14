"use client";

/**
 * Formulario de movimiento fijo (RF-MF-001 / RF-MF-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Toggle Gasto/Ingreso (o read-only con badge en edición)
 * - Input de monto mono 20px con prefijo "$"
 * - Nota de recurrencia (.field-note con ícono Repeat)
 * - Footer: Cancelar / Guardar
 *
 * Lógica de negocio preservada intacta.
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Repeat, Check, ArrowDown, ArrowUp } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  recurring: Recurring | null;
  onClose: () => void;
  defaultMonth?: string;
  viewMonth?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const isLoading = isEditing ? isUpdating : isCreating;

  const defaultValues: RecurringFormData = isEditing
    ? {
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
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

  useEffect(() => {
    if (isEditing) {
      reset({
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        startMonth: getCurrentMonth(),
        categoryId: recurring.categoryId,
        description: recurring.description ?? "",
      });
    }
  }, [recurring, isEditing, reset]);

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

  const availableCategories = filterCategoriesByType(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    selectedType,
  );

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
    if (amountCents === null) return;

    if (isEditing) {
      const result = await updateRecurring(recurring.id, {
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
      >
        <div className="px-[22px] pb-[22px] space-y-[14px]">
          {/* ── Tipo (toggle o read-only en edición) ── */}
          {isEditing ? (
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Tipo
              </Label>
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
                {recurring.type === "EXPENSE" ? (
                  <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} className="text-income-ink" aria-hidden="true" />
                )}
                {recurring.type === "EXPENSE" ? "Gasto" : "Ingreso"}
              </div>
              {/* Campo oculto para que RHF lo tenga en el form state */}
              <input type="hidden" {...register("type")} />
            </div>
          ) : (
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("EXPENSE")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] px-3 py-3 text-[14px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]",
                      field.value === "EXPENSE"
                        ? "border-expense bg-expense-soft text-expense-ink"
                        : "border-line bg-panel text-muted hover:text-ink",
                    )}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("INCOME")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] px-3 py-3 text-[14px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--income-soft)]",
                      field.value === "INCOME"
                        ? "border-income bg-income-soft text-income-ink"
                        : "border-line bg-panel text-muted hover:text-ink",
                    )}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    Ingreso
                  </button>
                </div>
              )}
            />
          )}

          {/* ── Monto ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="rec-amount" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Monto
            </Label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-ctl border-[1.5px] px-[13px] py-[11px] transition-colors duration-[140ms]",
                "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
                errors.amountInput
                  ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                  : "border-line-strong bg-panel",
              )}
            >
              <span className="text-[15px] text-muted mono shrink-0">$</span>
              <input
                id="rec-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                className="flex-1 border-none outline-none bg-transparent mono text-[20px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
                {...register("amountInput")}
              />
            </div>
            {errors.amountInput && (
              <p className="text-[12px] text-expense-ink">{errors.amountInput.message}</p>
            )}
          </div>

          {/* ── Mes de inicio (solo en modo crear) ── */}
          {!isEditing && (
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="rec-start-month" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Mes de inicio
              </Label>
              <Input
                id="rec-start-month"
                type="month"
                error={errors.startMonth?.message}
                {...register("startMonth")}
              />
              <p className="text-[12.5px] text-muted">
                Mes a partir del cual aparece este gasto fijo
              </p>
            </div>
          )}

          {/* ── Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="rec-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Categoría
              </Label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="text-[12.5px] font-semibold text-accent-ink hover:text-accent transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-sm"
              >
                + Nueva
              </button>
            </div>

            {noCategoriesAvailable ? (
              <div className="flex items-start gap-[11px] rounded-ctl border px-[14px] py-[13px] bg-expense-soft" style={{ borderColor: "oklch(0.57 0.16 27 / 0.25)" }}>
                <AlertTriangle size={18} className="text-expense-ink shrink-0 mt-[1px]" aria-hidden="true" />
                <div className="text-[13px] leading-[1.45] text-expense-ink">
                  <b className="font-bold">Sin categorías para este tipo.</b>{" "}
                  <Link
                    href="/categorias"
                    className="font-bold underline underline-offset-[2px] text-expense-ink hover:opacity-80"
                    onClick={onClose}
                  >
                    Creá una categoría
                  </Link>{" "}
                  o usá el botón &ldquo;+ Nueva&rdquo; de arriba.
                </div>
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

          {/* ── Nota de recurrencia (solo en crear) ── */}
          {!isEditing && (
            <div className="flex items-center gap-[7px] pt-[2px] text-[12.5px] text-muted">
              <Repeat size={14} className="text-accent-ink shrink-0" aria-hidden="true" />
              Se registra automáticamente cada mes a partir del mes de inicio.
            </div>
          )}

          {/* ── Descripción ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="rec-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="rec-description"
              type="text"
              placeholder="Ej: Alquiler departamento"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || noCategoriesAvailable}
              className="gap-1.5"
            >
              <Check size={14} aria-hidden="true" />
              {isLoading
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Guardar"}
            </Button>
          </div>
        </div>
      </form>

      {/* ── Modal inline de nueva categoría (RF-MU-004) ── */}
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
