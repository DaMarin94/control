"use client";

/**
 * Formulario de movimiento en cuotas (RF-MC-001 / RF-MC-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Badge "Gasto" read-only (cuotas son siempre EXPENSE)
 * - Monto por cuota: input mono 20px con prefijo "$"
 * - Grid 2-col para Cantidad de cuotas + Mes de inicio
 * - Footer: Cancelar / Guardar
 *
 * Lógica de negocio preservada intacta.
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Check, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CurrencyExchangeBlock } from "@/components/ui/currency-exchange-block";
import { useCategories } from "@/hooks/use-categories";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { type Category, type CategoryScope } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/categorias/category-form-modal";
import { type InstallmentGroup } from "@/types/installment";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  getCurrentMonth,
} from "@/lib/format";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Schema ───────────────────────────────────────────────────────────────────

const installmentSchema = z.object({
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
  currency: z.enum(["ARS", "USD"]),
  /** Input de cotización como string. Solo se valida cuando currency !== defaultCurrency. */
  exchangeRateInput: z.string(),
  totalInstallments: z
    .string()
    .min(1, "La cantidad de cuotas es requerida")
    .refine(
      (val) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && Number.isInteger(num);
      },
      { message: "Ingresá una cantidad de cuotas mayor a 0" },
    ),
  startMonth: z
    .string()
    .min(1, "El mes de inicio es requerido")
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
  categoryId: z.string().min(1, "La categoría es requerida"),
  description: z.string().optional(),
});

type InstallmentFormData = z.infer<typeof installmentSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallmentFormProps {
  installment: InstallmentGroup | null;
  onClose: () => void;
  defaultMonth?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCategoriesForExpense(
  categories: { id: string; name: string; scope: CategoryScope }[],
) {
  return categories.filter((cat) => cat.scope === "EXPENSE" || cat.scope === "BOTH");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InstallmentForm({ installment, onClose, defaultMonth }: InstallmentFormProps) {
  const isEditing = installment !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createInstallment, updateInstallment, isCreating, isUpdating } = useInstallments();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  const isLoading = isEditing ? isUpdating : isCreating;

  // Cotización pre-cargada:
  // - Editando: la del grupo de cuotas (siempre presente, nunca null en el backend).
  // - Creando: el lastExchangeRate del usuario, o vacío si aún no tiene historial.
  const preloadedExchangeRateInput = isEditing
    ? formatExchangeRate(installment.exchangeRate ?? 1)
    : lastExchangeRate != null
      ? formatExchangeRate(lastExchangeRate)
      : "";

  const defaultValues: InstallmentFormData = isEditing
    ? {
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        currency: installment.currency ?? defaultCurrency,
        exchangeRateInput: formatExchangeRate(installment.exchangeRate ?? 1),
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        description: installment.description ?? "",
      }
    : {
        amountInput: "",
        currency: defaultCurrency,
        exchangeRateInput: preloadedExchangeRateInput,
        totalInstallments: "",
        startMonth: defaultMonth ?? getCurrentMonth(),
        categoryId: "",
        description: "",
      };

  const [initialExchangeRateInput] = useState(defaultValues.exchangeRateInput);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isEditing) {
      reset({
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        currency: installment.currency ?? defaultCurrency,
        exchangeRateInput: formatExchangeRate(installment.exchangeRate ?? 1),
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        description: installment.description ?? "",
      });
      setIsExchangeRateModified(false);
    }
  }, [installment, isEditing, reset, defaultCurrency]);

  // Pre-cargar cotización cuando defaultCurrency o lastExchangeRate cambian (solo en crear)
  useEffect(() => {
    if (!isEditing) {
      setValue("currency", defaultCurrency);
      setValue(
        "exchangeRateInput",
        lastExchangeRate != null ? formatExchangeRate(lastExchangeRate) : "",
      );
      setIsExchangeRateModified(false);
    }
  }, [defaultCurrency, lastExchangeRate, isEditing, setValue]);

  const exchangeRateInput = watch("exchangeRateInput");

  useEffect(() => {
    setIsExchangeRateModified(
      exchangeRateInput !== initialExchangeRateInput && exchangeRateInput !== ""
    );
  }, [exchangeRateInput, initialExchangeRateInput]);

  const availableCategories = filterCategoriesForExpense(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
  );

  const noCategoriesAvailable = availableCategories.length === 0;

  async function onSubmit(data: InstallmentFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return;

    const totalInstallments = parseInt(data.totalInstallments, 10);

    // Validar cotización SIEMPRE (no solo en cross-rate): el roadmap exige capturar
    // y persistir la cotización real también cuando moneda === defaultCurrency.
    const parsedExchangeRate = parseExchangeRateInput(data.exchangeRateInput);
    if (parsedExchangeRate === null) {
      setExchangeRateError("Ingresá una cotización mayor a 0");
      return;
    }
    setExchangeRateError(undefined);

    if (isEditing) {
      const result = await updateInstallment(installment.id, {
        amountCents,
        totalInstallments,
        startMonth: data.startMonth,
        categoryId: data.categoryId,
        description: data.description || null,
        exchangeRate: parsedExchangeRate,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      toast.success("Movimiento actualizado correctamente.");
      onClose();
    } else {
      const result = await createInstallment({
        type: "EXPENSE",
        amountCents,
        totalInstallments,
        startMonth: data.startMonth,
        categoryId: data.categoryId,
        description: data.description || undefined,
        currency: data.currency,
        exchangeRate: parsedExchangeRate,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      const startMonth = data.startMonth;
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
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-[22px] pb-[22px] space-y-[14px]">
          {/* ── Tipo (read-only: siempre Gasto) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Tipo
            </Label>
            <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
              <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
              Gasto
            </div>
            <p className="text-[12px] text-muted">
              Los movimientos en cuotas son siempre de tipo Gasto en esta versión.
            </p>
          </div>

          {/* ── Monto por cuota ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="inst-amount" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Monto por cuota
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
                id="inst-amount"
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

          {/* ── Moneda y cotización ── */}
          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <CurrencyExchangeBlock
                currency={field.value as CurrencyCode}
                exchangeRateInput={exchangeRateInput}
                defaultCurrency={defaultCurrency}
                isExchangeRateModified={isExchangeRateModified}
                exchangeRateError={exchangeRateError}
                onCurrencyChange={(val) => {
                  field.onChange(val);
                }}
                onExchangeRateChange={(val) => setValue("exchangeRateInput", val)}
                exchangeRateInputId="inst-exchange-rate"
              />
            )}
          />

          {/* ── Cantidad de cuotas + Mes de inicio (grid 2-col) ── */}
          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="inst-total" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Cant. de cuotas
              </Label>
              <Input
                id="inst-total"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="12"
                error={errors.totalInstallments?.message}
                {...register("totalInstallments")}
              />
            </div>
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="inst-start-month" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Mes de inicio
              </Label>
              <Input
                id="inst-start-month"
                type="month"
                error={errors.startMonth?.message}
                {...register("startMonth")}
              />
            </div>
          </div>
          {(errors.totalInstallments || errors.startMonth) && (
            <div className="space-y-1">
              {errors.totalInstallments && (
                <p className="text-[12px] text-expense-ink">{errors.totalInstallments.message}</p>
              )}
              {errors.startMonth && (
                <p className="text-[12px] text-expense-ink">{errors.startMonth.message}</p>
              )}
            </div>
          )}

          {/* ── Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="inst-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                  <b className="font-bold">Sin categorías para Gasto.</b>{" "}
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
                    id="inst-category"
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
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="inst-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="inst-description"
              type="text"
              placeholder="Ej: Notebook Lenovo"
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
          lockScopeToType="EXPENSE"
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
